import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "./workspace.schemas.js";

export class WorkspaceService {
  async listUserWorkspaces(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            timezone: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async createWorkspace(userId: string, input: CreateWorkspaceInput) {
    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: input.name.trim(),
          timezone: input.timezone?.trim() || "UTC",
        },
      });

      await tx.membership.create({
        data: {
          userId,
          workspaceId: ws.id,
          role: "OWNER",
        },
      });

      return ws;
    });

    return {
      ...workspace,
      role: "OWNER" as const,
    };
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: {
          select: {
            memberships: true,
            posts: true,
            mediaAssets: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw AppError.notFound("Workspace not found");
    }

    return {
      id: workspace.id,
      name: workspace.name,
      timezone: workspace.timezone,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      stats: {
        memberCount: workspace._count.memberships,
        postCount: workspace._count.posts,
        mediaCount: workspace._count.mediaAssets,
      },
    };
  }

  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
    const data: Record<string, any> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.timezone !== undefined) data.timezone = input.timezone.trim();

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });

    return workspace;
  }

  async listMembers(workspaceId: string) {
    const members = await prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }
}

export const workspaceService = new WorkspaceService();
