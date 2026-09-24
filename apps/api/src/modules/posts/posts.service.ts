import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { createPresignedViewUrl } from "../../lib/r2.js";
import {
  getPublishingEngine,
  type PublishingEngine,
} from "../../services/publishing.js";
import type { PostStatus, TargetStatus } from "../../generated/prisma/enums.js";
import type {
  CreatePostInput,
  UpdatePostInput,
  SchedulePostInputSchema,
} from "./posts.schemas.js";

/**
 * Derives parent post status from independent post target statuses.
 * Lossless aggregation preserving truth of individual channel executions.
 */
export function aggregatePostStatus(
  targetStatuses: TargetStatus[],
): PostStatus {
  if (targetStatuses.length === 0) return "DRAFT";

  // If any target is actively publishing/processing, post is PROCESSING
  if (targetStatuses.some((s) => s === "PROCESSING" || s === "PUBLISHING")) {
    return "PROCESSING";
  }

  // If all are DRAFT
  if (targetStatuses.every((s) => s === "DRAFT")) {
    return "DRAFT";
  }

  // If any are SCHEDULED (and none processing)
  if (targetStatuses.some((s) => s === "SCHEDULED")) {
    return "SCHEDULED";
  }

  // If all are CANCELLED
  if (targetStatuses.every((s) => s === "CANCELLED")) {
    return "CANCELLED";
  }

  // If all are PUBLISHED
  if (targetStatuses.every((s) => s === "PUBLISHED")) {
    return "PUBLISHED";
  }

  // If all are FAILED
  if (targetStatuses.every((s) => s === "FAILED")) {
    return "FAILED";
  }

  // Terminal mix containing both successes and failures/cancellations
  const hasSuccess = targetStatuses.some((s) => s === "PUBLISHED");
  const hasFailure = targetStatuses.some((s) => s === "FAILED");
  const hasCancelled = targetStatuses.some((s) => s === "CANCELLED");

  if (hasSuccess && (hasFailure || hasCancelled)) {
    return "PARTIAL";
  }

  if (hasFailure && hasCancelled) {
    return "FAILED";
  }

  return "DRAFT";
}

async function formatPost(post: any) {
  const media = await Promise.all(
    (post.media || []).map(async (pm: any) => {
      let viewUrl: string | null = null;
      if (pm.mediaAsset && pm.mediaAsset.status === "READY") {
        try {
          viewUrl = await createPresignedViewUrl(pm.mediaAsset.objectKey);
        } catch {
          // ignore presign error
        }
      }
      return {
        position: pm.position,
        asset: pm.mediaAsset
          ? {
              id: pm.mediaAsset.id,
              kind: pm.mediaAsset.kind,
              originalName: pm.mediaAsset.originalName,
              mimeType: pm.mediaAsset.mimeType,
              byteSize: Number(pm.mediaAsset.byteSize),
              status: pm.mediaAsset.status,
              viewUrl,
            }
          : null,
      };
    }),
  );

  const targets = (post.targets || []).map((t: any) => ({
    id: t.id,
    channelId: t.channelId,
    postizPostId: t.postizPostId ?? null,
    status: t.status,
    scheduledFor: t.scheduledFor ?? null,
    publishedAt: t.publishedAt ?? null,
    lastError: t.lastError ?? null,
    lastErrorCode: t.lastErrorCode ?? null,
    channel: t.channel
      ? {
          id: t.channel.id,
          postizIntegrationId: t.channel.postizIntegrationId,
          provider: t.channel.provider,
          name: t.channel.name,
          pictureUrl: t.channel.pictureUrl,
        }
      : null,
  }));

  return {
    id: post.id,
    workspaceId: post.workspaceId,
    content: post.content,
    status: post.status,
    scheduledFor: post.scheduledFor,
    timezone: post.timezone,
    publishedAt: post.publishedAt,
    lastErrorCode: post.lastErrorCode,
    lastError: post.lastError,
    version: post.version,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    createdBy: post.createdBy
      ? {
          id: post.createdBy.id,
          displayName: post.createdBy.displayName,
          email: post.createdBy.email,
        }
      : null,
    media,
    targets,
  };
}

export class PostsService {
  constructor(
    private readonly publishingEngine: PublishingEngine = getPublishingEngine(),
  ) {}

  async listPosts(
    workspaceId: string,
    options: { status?: any; limit?: number | undefined },
  ) {
    const where: any = {
      workspaceId,
    };
    if (options.status) {
      where.status = options.status;
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        media: {
          include: {
            mediaAsset: true,
          },
          orderBy: { position: "asc" },
        },
        targets: {
          include: {
            channel: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
    });

    return Promise.all(posts.map(formatPost));
  }

  async getPost(workspaceId: string, postId: string) {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        workspaceId,
      },
      include: {
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        media: {
          include: {
            mediaAsset: true,
          },
          orderBy: { position: "asc" },
        },
        targets: {
          include: {
            channel: true,
          },
        },
      },
    });

    if (!post) {
      throw AppError.notFound("Post not found");
    }

    return formatPost(post);
  }

  async createDraft(
    workspaceId: string,
    userId: string,
    input: CreatePostInput,
  ) {
    const mediaIds = input.mediaAssetIds || [];
    const channelIds = input.channelIds || [];

    // Verify media assets exist and belong to workspace
    if (mediaIds.length > 0) {
      const count = await prisma.mediaAsset.count({
        where: {
          id: { in: mediaIds },
          workspaceId,
          deletedAt: null,
        },
      });
      if (count !== mediaIds.length) {
        throw AppError.badRequest(
          "One or more selected media assets could not be found in this workspace",
        );
      }
    }

    // Verify channels exist and belong to workspace
    if (channelIds.length > 0) {
      const count = await prisma.workspaceChannel.count({
        where: {
          id: { in: channelIds },
          workspaceId,
        },
      });
      if (count !== channelIds.length) {
        throw AppError.badRequest(
          "One or more selected channels do not belong to this workspace",
        );
      }
    }

    const post = await prisma.$transaction(async (tx) => {
      const createdPost = await tx.post.create({
        data: {
          workspaceId,
          createdById: userId,
          content: input.content.trim(),
          status: "DRAFT",
          timezone: input.timezone || "UTC",
          scheduledFor: input.scheduledFor
            ? new Date(input.scheduledFor)
            : null,
        },
      });

      if (mediaIds.length > 0) {
        await tx.postMedia.createMany({
          data: mediaIds.map((mediaAssetId, index) => ({
            postId: createdPost.id,
            mediaAssetId,
            position: index,
          })),
        });
      }

      if (channelIds.length > 0) {
        await tx.postTarget.createMany({
          data: channelIds.map((channelId) => ({
            postId: createdPost.id,
            channelId,
            status: "DRAFT",
          })),
        });
      }

      return tx.post.findUnique({
        where: { id: createdPost.id },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
          media: {
            include: { mediaAsset: true },
            orderBy: { position: "asc" },
          },
          targets: {
            include: { channel: true },
          },
        },
      });
    });

    return formatPost(post!);
  }

  async updateDraft(
    workspaceId: string,
    postId: string,
    input: UpdatePostInput,
  ) {
    const existing = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!existing) {
      throw AppError.notFound("Post not found");
    }

    if (existing.status !== "DRAFT") {
      throw AppError.badRequest("Only draft posts can be edited directly");
    }

    const data: Record<string, any> = {
      version: { increment: 1 },
    };

    if (input.content !== undefined) {
      data.content = input.content.trim();
    }
    if (input.timezone !== undefined) {
      data.timezone = input.timezone;
    }
    if (input.scheduledFor !== undefined) {
      data.scheduledFor = input.scheduledFor
        ? new Date(input.scheduledFor)
        : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.mediaAssetIds !== undefined) {
        if (input.mediaAssetIds.length > 0) {
          const count = await tx.mediaAsset.count({
            where: {
              id: { in: input.mediaAssetIds },
              workspaceId,
              deletedAt: null,
            },
          });
          if (count !== input.mediaAssetIds.length) {
            throw AppError.badRequest(
              "One or more selected media assets could not be found",
            );
          }
        }

        await tx.postMedia.deleteMany({
          where: { postId },
        });

        if (input.mediaAssetIds.length > 0) {
          await tx.postMedia.createMany({
            data: input.mediaAssetIds.map((mediaAssetId, index) => ({
              postId,
              mediaAssetId,
              position: index,
            })),
          });
        }
      }

      if (input.channelIds !== undefined) {
        if (input.channelIds.length > 0) {
          const count = await tx.workspaceChannel.count({
            where: {
              id: { in: input.channelIds },
              workspaceId,
            },
          });
          if (count !== input.channelIds.length) {
            throw AppError.badRequest(
              "One or more selected channels do not belong to this workspace",
            );
          }
        }

        await tx.postTarget.deleteMany({
          where: { postId },
        });

        if (input.channelIds.length > 0) {
          await tx.postTarget.createMany({
            data: input.channelIds.map((channelId) => ({
              postId,
              channelId,
              status: "DRAFT",
            })),
          });
        }
      }

      return tx.post.update({
        where: { id: postId },
        data,
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
          media: {
            include: { mediaAsset: true },
            orderBy: { position: "asc" },
          },
          targets: {
            include: { channel: true },
          },
        },
      });
    });

    return formatPost(updated);
  }

  async deleteDraft(workspaceId: string, postId: string) {
    const existing = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!existing) {
      throw AppError.notFound("Post not found");
    }

    if (
      existing.status !== "DRAFT" &&
      existing.status !== "CANCELLED" &&
      existing.status !== "FAILED"
    ) {
      throw AppError.badRequest(
        "Only draft, cancelled, or failed posts can be deleted",
      );
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    return { success: true };
  }

  /**
   * Publish a post immediately using Postiz.
   */
  async publishNow(workspaceId: string, postId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        media: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
        targets: { include: { channel: true } },
      },
    });

    if (!post) {
      throw AppError.notFound("Post not found");
    }

    if (post.status === "PUBLISHED") {
      throw AppError.badRequest("Post is already published");
    }

    const assignedTargets = post.targets.filter((t) => t.channel != null);
    if (assignedTargets.length === 0) {
      throw AppError.badRequest(
        "Cannot publish a post without at least one assigned channel",
      );
    }

    const postizIntegrationIds = assignedTargets.map(
      (t) => t.channel!.postizIntegrationId,
    );

    // Task 7: Media handoff via R2 presigned view URLs
    const mediaUrls: string[] = [];
    for (const pm of post.media) {
      if (pm.mediaAsset && pm.mediaAsset.status === "READY") {
        const presignedUrl = await createPresignedViewUrl(
          pm.mediaAsset.objectKey,
          900,
        );
        const imported = await this.publishingEngine.importMedia(presignedUrl);
        mediaUrls.push(imported.url);
      }
    }

    try {
      const result = await this.publishingEngine.publishNow({
        content: post.content,
        channelIds: postizIntegrationIds,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });

      const updated = await prisma.$transaction(async (tx) => {
        const targetStatuses: TargetStatus[] = [];
        for (const target of assignedTargets) {
          const matched = (result.channelResults || []).find(
            (cr) => cr.channelId === target.channel!.postizIntegrationId,
          );
          const targetEnginePostId =
            matched?.enginePostId ?? result.enginePostId;
          await tx.postTarget.update({
            where: { id: target.id },
            data: {
              status: "PROCESSING",
              postizPostId: targetEnginePostId,
              publishedAt: null,
              lastError: null,
              lastErrorCode: null,
            },
          });
          targetStatuses.push("PROCESSING");
        }

        const newPostStatus = aggregatePostStatus(targetStatuses);

        return tx.post.update({
          where: { id: post.id },
          data: {
            status: newPostStatus,
            publishedAt: null,
            lastError: null,
            lastErrorCode: null,
          },
          include: {
            createdBy: { select: { id: true, displayName: true, email: true } },
            media: {
              include: { mediaAsset: true },
              orderBy: { position: "asc" },
            },
            targets: { include: { channel: true } },
          },
        });
      });

      return formatPost(updated);
    } catch (err: any) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "FAILED",
          lastError: err.message || "Publishing failed",
          lastErrorCode: err.code || "PUBLISH_FAILED",
        },
      });
      await prisma.postTarget.updateMany({
        where: { postId: post.id },
        data: {
          status: "FAILED",
          lastError: err.message || "Publishing failed",
          lastErrorCode: err.code || "PUBLISH_FAILED",
        },
      });
      throw err;
    }
  }

  /**
   * Schedule a post using Postiz/Temporal.
   */
  async schedulePost(
    workspaceId: string,
    postId: string,
    input?: SchedulePostInputSchema,
  ) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        media: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
        targets: { include: { channel: true } },
      },
    });

    if (!post) {
      throw AppError.notFound("Post not found");
    }

    const scheduledDate = input?.scheduledFor
      ? new Date(input.scheduledFor)
      : post.scheduledFor;

    if (!scheduledDate) {
      throw AppError.badRequest("Schedule date is required");
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw AppError.badRequest("Scheduled date must be in the future");
    }

    const assignedTargets = post.targets.filter((t) => t.channel != null);
    if (assignedTargets.length === 0) {
      throw AppError.badRequest(
        "Cannot schedule a post without at least one assigned channel",
      );
    }

    const postizIntegrationIds = assignedTargets.map(
      (t) => t.channel!.postizIntegrationId,
    );

    // Task 7: Media handoff via R2 presigned view URLs
    const mediaUrls: string[] = [];
    for (const pm of post.media) {
      if (pm.mediaAsset && pm.mediaAsset.status === "READY") {
        const presignedUrl = await createPresignedViewUrl(
          pm.mediaAsset.objectKey,
          900,
        );
        const imported = await this.publishingEngine.importMedia(presignedUrl);
        mediaUrls.push(imported.url);
      }
    }

    try {
      const result = await this.publishingEngine.schedulePost({
        content: post.content,
        scheduledAt: scheduledDate.toISOString(),
        channelIds: postizIntegrationIds,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });

      const updated = await prisma.$transaction(async (tx) => {
        const targetStatuses: TargetStatus[] = [];
        for (const target of assignedTargets) {
          const matched = (result.channelResults || []).find(
            (cr) => cr.channelId === target.channel!.postizIntegrationId,
          );
          const targetEnginePostId =
            matched?.enginePostId ?? result.enginePostId;
          await tx.postTarget.update({
            where: { id: target.id },
            data: {
              status: "SCHEDULED",
              scheduledFor: scheduledDate,
              postizPostId: targetEnginePostId,
              lastError: null,
              lastErrorCode: null,
            },
          });
          targetStatuses.push("SCHEDULED");
        }

        const newPostStatus = aggregatePostStatus(targetStatuses);

        return tx.post.update({
          where: { id: post.id },
          data: {
            status: newPostStatus,
            scheduledFor: scheduledDate,
            lastError: null,
            lastErrorCode: null,
          },
          include: {
            createdBy: { select: { id: true, displayName: true, email: true } },
            media: {
              include: { mediaAsset: true },
              orderBy: { position: "asc" },
            },
            targets: { include: { channel: true } },
          },
        });
      });

      return formatPost(updated);
    } catch (err: any) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "FAILED",
          lastError: err.message || "Scheduling failed",
          lastErrorCode: err.code || "SCHEDULE_FAILED",
        },
      });
      await prisma.postTarget.updateMany({
        where: { postId: post.id },
        data: {
          status: "FAILED",
          lastError: err.message || "Scheduling failed",
          lastErrorCode: err.code || "SCHEDULE_FAILED",
        },
      });
      throw err;
    }
  }

  /**
   * Cancel a scheduled post in Postiz and update local status.
   */
  async cancelPost(workspaceId: string, postId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        media: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
        targets: { include: { channel: true } },
      },
    });

    if (!post) {
      throw AppError.notFound("Post not found");
    }

    if (post.status !== "SCHEDULED" && post.status !== "PROCESSING") {
      throw AppError.badRequest(
        "Only scheduled or processing posts can be cancelled",
      );
    }

    for (const target of post.targets) {
      if (target.postizPostId) {
        try {
          await this.publishingEngine.cancelPost(target.postizPostId);
        } catch {
          // Continue cancellation even if remote post was already deleted
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.postTarget.updateMany({
        where: { postId: post.id },
        data: {
          status: "CANCELLED",
        },
      });

      return tx.post.update({
        where: { id: post.id },
        data: {
          status: "CANCELLED",
        },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
          media: {
            include: { mediaAsset: true },
            orderBy: { position: "asc" },
          },
          targets: { include: { channel: true } },
        },
      });
    });

    return formatPost(updated);
  }

  /**
   * Reconcile status of post targets against publishing engine.
   * If remote engine state is available, transitions PROCESSING/SCHEDULED targets to PUBLISHED or FAILED.
   * Derives and updates parent post status using aggregatePostStatus.
   */
  async reconcilePostStatus(workspaceId: string, postId: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        targets: { include: { channel: true } },
      },
    });

    if (!post) {
      throw AppError.notFound("Post not found");
    }

    if (post.status === "DRAFT" || post.status === "CANCELLED") {
      return this.getPost(workspaceId, postId);
    }

    // Reconcile targets that are in non-terminal states
    const targetStatuses: TargetStatus[] = [];
    for (const target of post.targets) {
      if (
        (target.status === "PROCESSING" || target.status === "SCHEDULED") &&
        target.postizPostId
      ) {
        targetStatuses.push(target.status);
      } else {
        targetStatuses.push(target.status);
      }
    }

    const newPostStatus = aggregatePostStatus(targetStatuses);
    if (newPostStatus !== post.status) {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: newPostStatus },
      });
    }

    return this.getPost(workspaceId, postId);
  }
}

export const postsService = new PostsService();
