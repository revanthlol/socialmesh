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
   * Generate an OAuth connect URL for a provider from Postiz.
   */
  async getConnectUrl(provider: string) {
    const url = await this.publishingEngine.getChannelConnectUrl(provider);
    return { url };
  }
}

export const channelsService = new ChannelsService();
