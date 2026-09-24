import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  getPublishingEngine,
  type PublishingEngine,
} from "../../services/publishing.js";
import type { AssignChannelInput } from "./channels.schemas.js";

export class ChannelsService {
  constructor(
    private readonly publishingEngine: PublishingEngine = getPublishingEngine(),
  ) {}

  /**
   * List channels assigned to a specific workspace.
   * Workspace isolation: only returns channels mapped to this workspaceId.
   */
  async listWorkspaceChannels(workspaceId: string) {
    const channels = await prisma.workspaceChannel.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return channels.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      postizIntegrationId: c.postizIntegrationId,
      provider: c.provider,
      name: c.name,
      pictureUrl: c.pictureUrl,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * List all integrations from the shared Postiz organization,
   * annotating each with whether it is assigned to the current workspace or another workspace.
   * Restricted to OWNER / ADMIN.
   */
  async listAvailableChannels(workspaceId: string) {
    let postizIntegrations: Array<{
      id: string;
      provider: string;
      name: string;
      pictureUrl?: string | null | undefined;
      isActive: boolean;
    }> = [];
    let isEngineOffline = false;

    try {
      postizIntegrations = await this.publishingEngine.listChannels();
    } catch {
      isEngineOffline = true;
    }

    // Query all existing workspace channel assignments
    const allAssignments = await prisma.workspaceChannel.findMany({
      select: {
        id: true,
        workspaceId: true,
        postizIntegrationId: true,
      },
    });

    const currentAssignedIntegrationIds = new Set(
      allAssignments
        .filter((a) => a.workspaceId === workspaceId)
        .map((a) => a.postizIntegrationId),
    );

    const assignedByIntegration = new Map<string, string[]>();
    for (const assignment of allAssignments) {
      const list =
        assignedByIntegration.get(assignment.postizIntegrationId) || [];
      list.push(assignment.workspaceId);
      assignedByIntegration.set(assignment.postizIntegrationId, list);
    }

    const channels = postizIntegrations.map((item) => {
      const assignedWorkspaces = assignedByIntegration.get(item.id) || [];
      const isAssignedToCurrent = currentAssignedIntegrationIds.has(item.id);
      const isAssignedToOther = assignedWorkspaces.some(
        (wsId) => wsId !== workspaceId,
      );

      return {
        id: item.id,
        provider: item.provider,
        name: item.name,
        pictureUrl: item.pictureUrl ?? null,
        isActive: item.isActive,
        isAssignedToCurrent,
        isAssignedToOther,
        assignedWorkspacesCount: assignedWorkspaces.length,
      };
    });

    return {
      channels,
      isEngineOffline,
    };
  }

  /**
   * Assign a Postiz integration to the current workspace.
   */
  async assignChannel(workspaceId: string, input: AssignChannelInput) {
    const existing = await prisma.workspaceChannel.findUnique({
      where: {
        workspaceId_postizIntegrationId: {
          workspaceId,
          postizIntegrationId: input.postizIntegrationId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.workspaceChannel.create({
      data: {
        workspaceId,
        postizIntegrationId: input.postizIntegrationId,
        provider: input.provider,
        name: input.name,
        pictureUrl: input.pictureUrl ?? null,
      },
    });
  }

  /**
   * Remove a channel assignment from the current workspace.
   * Does NOT disconnect or remove the integration from Postiz.
   */
  async removeChannelAssignment(workspaceId: string, channelId: string) {
    const channel = await prisma.workspaceChannel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) {
      throw AppError.notFound("Channel assignment not found in this workspace");
    }

    await prisma.workspaceChannel.delete({
      where: { id: channelId },
    });

    return { success: true };
  }

  /**
   * Disconnect the underlying social integration from Postiz.
   * Also deletes all workspace assignments referencing this integration.
   */
  async disconnectChannel(workspaceId: string, channelId: string) {
    const channel = await prisma.workspaceChannel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) {
      throw AppError.notFound("Channel not found in this workspace");
    }

    try {
      await this.publishingEngine.disconnectChannel(
        channel.postizIntegrationId,
      );
    } catch (err: any) {
      // If already deleted upstream or engine offline, continue local cleanup
    }

    // Remove from this workspace and all other workspaces that mapped this integration
    await prisma.workspaceChannel.deleteMany({
      where: { postizIntegrationId: channel.postizIntegrationId },
    });

    return { success: true };
  }

  /**
   * Start an OAuth connection flow:
   * 1. Creates an expiring PendingChannelConnection in DB storing (workspaceId, userId, provider, stateToken, expiresAt).
   * 2. Requests provider connect URL from Postiz.
   * 3. Returns { url, stateToken }.
   */
  async startOAuthConnection(
    workspaceId: string,
    userId: string,
    provider: string,
  ) {
    // Verify user is an OWNER of this workspace
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership || membership.role !== "OWNER") {
      throw AppError.forbidden(
        "Only workspace owners can connect social accounts",
      );
    }

    const stateToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Persist pending connection state
    await prisma.pendingChannelConnection.create({
      data: {
        workspaceId,
        userId,
        provider,
        stateToken,
        expiresAt,
      },
    });

    const url = await this.publishingEngine.getChannelConnectUrl(provider);
    return { url, stateToken };
  }

  /**
   * Resolve an OAuth callback connection:
   * 1. Resolves PendingChannelConnection by stateToken.
   * 2. Validates not expired.
   * 3. Verifies calling user matches initiating user.
   * 4. Verifies user is still OWNER of the original workspace.
   * 5. Refreshes integrations from Postiz.
   * 6. Finds the integration matching this provider and assigns it to the original workspace.
   * 7. Consumes (deletes) the pending state record.
   */
  async resolvePendingConnection(userId: string, stateToken: string) {
    if (!stateToken || typeof stateToken !== "string") {
      throw AppError.badRequest("Invalid or missing OAuth state token");
    }

    const pending = await prisma.pendingChannelConnection.findUnique({
      where: { stateToken },
    });

    if (!pending) {
      throw AppError.badRequest("Unknown or invalid OAuth connection state");
    }

    if (pending.expiresAt < new Date()) {
      await prisma.pendingChannelConnection
        .delete({ where: { id: pending.id } })
        .catch(() => {});
      throw AppError.badRequest("OAuth connection state has expired");
    }

    if (pending.userId !== userId) {
      throw AppError.forbidden("Cross-user or cross-workspace claim denied");
    }

    // Verify still OWNER of the originating workspace
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: pending.workspaceId },
      },
    });
    if (!membership || membership.role !== "OWNER") {
      throw AppError.forbidden(
        "User is no longer owner of the initiating workspace",
      );
    }

    // Query Postiz integrations
    const integrations = await this.publishingEngine.listChannels();

    // Query existing assignments across all workspaces
    const existing = await prisma.workspaceChannel.findMany({
      select: { postizIntegrationId: true, workspaceId: true },
    });

    // Find integration for this provider that is unassigned, or matches provider
    const unassignedIntegrations = integrations.filter(
      (int) => !existing.some((e) => e.postizIntegrationId === int.id),
    );

    const matchingIntegration =
      unassignedIntegrations.find((int) => int.provider === pending.provider) ||
      unassignedIntegrations[0] ||
      integrations.find((int) => int.provider === pending.provider);

    let assignedChannel = null;
    if (matchingIntegration) {
      const alreadyInWorkspace = await prisma.workspaceChannel.findUnique({
        where: {
          workspaceId_postizIntegrationId: {
            workspaceId: pending.workspaceId,
            postizIntegrationId: matchingIntegration.id,
          },
        },
      });

      if (!alreadyInWorkspace) {
        assignedChannel = await prisma.workspaceChannel.create({
          data: {
            workspaceId: pending.workspaceId,
            postizIntegrationId: matchingIntegration.id,
            provider: matchingIntegration.provider,
            name: matchingIntegration.name,
            pictureUrl: matchingIntegration.pictureUrl ?? null,
          },
        });
      } else {
        assignedChannel = alreadyInWorkspace;
      }
    }

    // Single-use: delete pending record
    await prisma.pendingChannelConnection.delete({
      where: { id: pending.id },
    });

    return {
      success: true,
      workspaceId: pending.workspaceId,
      provider: pending.provider,
      channel: assignedChannel,
    };
  }

  /**
   * Generate an OAuth connect URL for a provider from Postiz.
   */
  async getConnectUrl(provider: string, workspaceId?: string, userId?: string) {
    if (workspaceId && userId) {
      return this.startOAuthConnection(workspaceId, userId, provider);
    }
    const url = await this.publishingEngine.getChannelConnectUrl(provider);
    return { url };
  }
}

export const channelsService = new ChannelsService();
