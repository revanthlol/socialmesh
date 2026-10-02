import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { createPresignedViewUrl, createDurableMediaUrl } from "../../lib/r2.js";
import {
  getPublishingEngine,
  type PublishingEngine,
} from "../../services/publishing.js";
import type {
  PostStatus,
  TargetStatus,
  MediaKind,
} from "../../generated/prisma/enums.js";
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

/**
 * Validates post content and attached media against assigned target channels.
 * Enforces provider capabilities for Facebook, Instagram, Threads, and LinkedIn.
 */
export function validatePostForTargets(
  content: string,
  mediaAssets: Array<{ kind: MediaKind | string; originalName?: string }>,
  channels: Array<{ provider: string; name?: string }>,
) {
  if (channels.length === 0) {
    return;
  }

  const images = mediaAssets.filter((m) => m.kind === "IMAGE");
  const videos = mediaAssets.filter((m) => m.kind === "VIDEO");
  const totalMedia = mediaAssets.length;
  const contentLength = (content || "").trim().length;

  for (const channel of channels) {
    const rawProvider = (channel.provider || "").toLowerCase();
    const channelName = channel.name || channel.provider;

    if (rawProvider.includes("facebook")) {
      if (images.length > 0 && videos.length > 0) {
        throw AppError.badRequest(
          "Facebook does not support mixing images and videos in a single post.",
        );
      }
      if (videos.length > 1) {
        throw AppError.badRequest(
          "Facebook does not support multiple videos in a single post.",
        );
      }
      if (images.length > 10) {
        throw AppError.badRequest(
          "Facebook supports a maximum of 10 photos per post.",
        );
      }
      if (contentLength > 63206) {
        throw AppError.badRequest(
          "Facebook posts cannot exceed 63,206 characters.",
        );
      }
    } else if (rawProvider.includes("instagram")) {
      if (totalMedia === 0) {
        throw AppError.badRequest(
          "Instagram requires at least one image or video attachment.",
        );
      }
      if (totalMedia > 10) {
        throw AppError.badRequest(
          "Instagram supports a maximum of 10 media items per carousel.",
        );
      }
      if (contentLength > 2200) {
        throw AppError.badRequest(
          "Instagram posts cannot exceed 2,200 characters.",
        );
      }
    } else if (rawProvider.includes("threads")) {
      if (contentLength > 500) {
        throw AppError.badRequest(
          "Threads posts cannot exceed 500 characters.",
        );
      }
      if (totalMedia > 10) {
        throw AppError.badRequest(
          "Threads supports a maximum of 10 media items per post.",
        );
      }
    } else if (rawProvider.includes("linkedin")) {
      if (contentLength > 3000) {
        throw AppError.badRequest(
          "LinkedIn posts cannot exceed 3,000 characters.",
        );
      }
      if (images.length > 0 && videos.length > 0) {
        throw AppError.badRequest(
          "LinkedIn does not support mixing images and videos in a single post.",
        );
      }
      if (videos.length > 1) {
        throw AppError.badRequest(
          "LinkedIn does not support multiple videos in a single post.",
        );
      }
      if (images.length > 9) {
        throw AppError.badRequest(
          "LinkedIn supports a maximum of 9 images per post.",
        );
      }
    } else {
      if (images.length > 0 && videos.length > 0) {
        throw AppError.badRequest(
          `${channelName} does not support mixing images and videos in a single post.`,
        );
      }
      if (videos.length > 1) {
        throw AppError.badRequest(
          `${channelName} does not support multiple videos in a single post.`,
        );
      }
    }
  }
}

/**
 * Validates attached media items against assigned target channels.
 * Enforces provider capabilities (retained for backward compatibility).
 */
export function validateMediaForTargets(
  mediaAssets: Array<{ kind: MediaKind | string; originalName?: string }>,
  channels: Array<{ provider: string; name?: string }>,
) {
  return validatePostForTargets("", mediaAssets, channels);
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
    providerPostUrl: t.providerPostUrl ?? null,
    providerPostId: t.providerPostId ?? null,
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

export type FormattedPost = Awaited<ReturnType<typeof formatPost>>;

export class PostsService {
  constructor(
    private readonly publishingEngine: PublishingEngine = getPublishingEngine(),
  ) {}

  async listPosts(
    workspaceId: string,
    options: {
      status?: any;
      limit?: number | undefined;
      skipReconcile?: boolean;
    },
  ): Promise<FormattedPost[]> {
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

    if (!options.skipReconcile) {
      const processingPosts = posts.filter(
        (p) => p.status === "PROCESSING" || p.status === "PUBLISHING",
      );
      if (processingPosts.length > 0) {
        await Promise.allSettled(
          processingPosts.map((p) =>
            this.reconcilePostStatus(workspaceId, p.id),
          ),
        );
        return this.listPosts(workspaceId, { ...options, skipReconcile: true });
      }
    }

    return Promise.all(posts.map(formatPost));
  }

  async getPost(
    workspaceId: string,
    postId: string,
    options?: { skipReconcile?: boolean },
  ): Promise<FormattedPost> {
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

    if (
      !options?.skipReconcile &&
      (post.status === "PROCESSING" || post.status === "PUBLISHING")
    ) {
      return this.reconcilePostStatus(workspaceId, postId);
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
    let foundMediaAssets: any[] = [];
    if (mediaIds.length > 0) {
      foundMediaAssets = await prisma.mediaAsset.findMany({
        where: {
          id: { in: mediaIds },
          workspaceId,
          deletedAt: null,
        },
      });
      if (foundMediaAssets.length !== mediaIds.length) {
        throw AppError.badRequest(
          "One or more selected media assets could not be found in this workspace",
        );
      }
    }

    // Verify channels exist and belong to workspace
    let foundChannels: any[] = [];
    if (channelIds.length > 0) {
      foundChannels = await prisma.workspaceChannel.findMany({
        where: {
          id: { in: channelIds },
          workspaceId,
        },
      });
      if (foundChannels.length !== channelIds.length) {
        throw AppError.badRequest(
          "One or more selected channels do not belong to this workspace",
        );
      }
    }

    if (foundChannels.length > 0) {
      validatePostForTargets(input.content, foundMediaAssets, foundChannels);
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

    if (existing.status !== "DRAFT" && existing.status !== "SCHEDULED") {
      throw AppError.badRequest("Only draft or scheduled posts can be edited");
    }

    const wasScheduled = existing.status === "SCHEDULED";
    if (wasScheduled) {
      const scheduledTargets = await prisma.postTarget.findMany({
        where: { postId, status: "SCHEDULED" },
      });
      for (const target of scheduledTargets) {
        if (target.postizPostId) {
          try {
            await this.publishingEngine.cancelPost(target.postizPostId);
          } catch {
            // Ignore cancellation error if already cancelled remotely
          }
        }
      }
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

      if (wasScheduled && data.scheduledFor === null) {
        data.status = "DRAFT";
      }

      const postAfterUpdate = await tx.post.update({
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

      const effectiveMediaAssets = postAfterUpdate.media
        .map((pm) => pm.mediaAsset)
        .filter(Boolean);
      const effectiveChannels = postAfterUpdate.targets
        .map((t) => t.channel)
        .filter(Boolean) as any[];

      validatePostForTargets(
        postAfterUpdate.content,
        effectiveMediaAssets,
        effectiveChannels,
      );

      return postAfterUpdate;
    });

    if (
      wasScheduled &&
      updated.scheduledFor &&
      updated.scheduledFor.getTime() > Date.now()
    ) {
      return this.schedulePost(workspaceId, postId);
    }

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

    const attachedMediaAssets = post.media
      .map((pm) => pm.mediaAsset)
      .filter(Boolean);
    validatePostForTargets(
      post.content,
      attachedMediaAssets,
      assignedTargets.map((t) => t.channel!),
    );

    const postizIntegrationIds = assignedTargets.map(
      (t) => t.channel!.postizIntegrationId,
    );

    // Media handoff via reachable R2 presigned view URLs
    const mediaItems: Array<{ id: string; url: string }> = [];
    for (const pm of post.media) {
      if (pm.mediaAsset && pm.mediaAsset.status === "READY") {
        const presignedUrl = await createPresignedViewUrl(
          pm.mediaAsset.objectKey,
          3600,
        );
        mediaItems.push({
          id: pm.mediaAsset.id,
          url: presignedUrl,
        });
      }
    }

    if (post.media.length > 0 && mediaItems.length !== post.media.length) {
      throw AppError.badRequest(
        "One or more attached media assets are not ready or missing in storage",
      );
    }

    try {
      const targets = assignedTargets.map((t) => ({
        channelId: t.channel!.postizIntegrationId,
        provider: t.channel!.provider,
        settings: t.channel!.provider.toLowerCase().includes("instagram")
          ? { post_type: "post" }
          : undefined,
      }));

      const result = await this.publishingEngine.publishNow({
        content: post.content,
        channelIds: postizIntegrationIds,
        targets,
        media: mediaItems.length > 0 ? mediaItems : undefined,
        mediaUrls:
          mediaItems.length > 0 ? mediaItems.map((m) => m.url) : undefined,
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

    const attachedMediaAssets = post.media
      .map((pm) => pm.mediaAsset)
      .filter(Boolean);
    validatePostForTargets(
      post.content,
      attachedMediaAssets,
      assignedTargets.map((t) => t.channel!),
    );

    const postizIntegrationIds = assignedTargets.map(
      (t) => t.channel!.postizIntegrationId,
    );

    const diffSeconds = Math.ceil(
      (scheduledDate.getTime() - Date.now()) / 1000,
    );

    // Media handoff: If scheduled within 5 days, use a direct R2 presigned URL covering the execution window.
    // If scheduled beyond 5 days (e.g. weeks/months into future), generate a durable signature-verified URL
    // that resolves/refreshes the presigned R2 URL at publish time without expiring!
    const mediaItems: Array<{ id: string; url: string }> = [];
    for (const pm of post.media) {
      if (pm.mediaAsset && pm.mediaAsset.status === "READY") {
        let mediaUrl: string;
        if (diffSeconds <= 432000) {
          mediaUrl = await createPresignedViewUrl(
            pm.mediaAsset.objectKey,
            Math.min(604800, diffSeconds + 86400),
          );
        } else {
          mediaUrl = createDurableMediaUrl(
            workspaceId,
            pm.mediaAsset.id,
            pm.mediaAsset.objectKey,
            pm.mediaAsset.originalName,
            scheduledDate,
          );
        }
        mediaItems.push({
          id: pm.mediaAsset.id,
          url: mediaUrl,
        });
      }
    }

    if (post.media.length > 0 && mediaItems.length !== post.media.length) {
      throw AppError.badRequest(
        "One or more attached media assets are not ready or missing in storage",
      );
    }

    try {
      const targets = assignedTargets.map((t) => ({
        channelId: t.channel!.postizIntegrationId,
        provider: t.channel!.provider,
        settings: t.channel!.provider.toLowerCase().includes("instagram")
          ? { post_type: "post" }
          : undefined,
      }));

      const result = await this.publishingEngine.schedulePost({
        content: post.content,
        scheduledAt: scheduledDate.toISOString(),
        channelIds: postizIntegrationIds,
        targets,
        media: mediaItems.length > 0 ? mediaItems : undefined,
        mediaUrls:
          mediaItems.length > 0 ? mediaItems.map((m) => m.url) : undefined,
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
  async reconcilePostStatus(
    workspaceId: string,
    postId: string,
  ): Promise<FormattedPost> {
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
      return this.getPost(workspaceId, postId, { skipReconcile: true });
    }

    // Reconcile targets that are in non-terminal states and have a remote Postiz ID
    const targetStatuses: TargetStatus[] = [];

    for (const target of post.targets) {
      let currentStatus = target.status;

      if (
        (target.status === "PROCESSING" ||
          target.status === "SCHEDULED" ||
          target.status === "PUBLISHING" ||
          target.status === "DISPATCHED") &&
        target.postizPostId
      ) {
        try {
          const approxDate =
            target.scheduledFor ?? post.scheduledFor ?? post.createdAt;
          const remote = await this.publishingEngine.getPostStatus(
            target.postizPostId,
            approxDate,
          );

          if (remote) {
            if (remote.state === "PUBLISHED") {
              currentStatus = "PUBLISHED";
              await prisma.postTarget.update({
                where: { id: target.id },
                data: {
                  status: "PUBLISHED",
                  publishedAt: new Date(),
                  providerPostUrl: remote.releaseUrl ?? target.providerPostUrl,
                  providerPostId: remote.releaseId ?? target.providerPostId,
                  lastError: null,
                  lastErrorCode: null,
                },
              });
            } else if (remote.state === "ERROR") {
              currentStatus = "FAILED";
              await prisma.postTarget.update({
                where: { id: target.id },
                data: {
                  status: "FAILED",
                  lastError: remote.error || "Publishing failed on provider",
                  lastErrorCode: "PUBLISH_FAILED",
                },
              });
            }
          }
        } catch {
          // If remote engine lookup fails, retain current status
        }
      }

      targetStatuses.push(currentStatus);
    }

    const newPostStatus = aggregatePostStatus(targetStatuses);
    const postUpdates: Record<string, any> = {};

    if (newPostStatus !== post.status) {
      postUpdates.status = newPostStatus;
      if (newPostStatus === "PUBLISHED" && !post.publishedAt) {
        postUpdates.publishedAt = new Date();
      }
    }

    if (newPostStatus === "FAILED") {
      const failedTarget = post.targets.find(
        (t) => t.status === "FAILED" || targetStatuses.includes("FAILED"),
      );
      if (failedTarget?.lastError && !post.lastError) {
        postUpdates.lastError = failedTarget.lastError;
        postUpdates.lastErrorCode =
          failedTarget.lastErrorCode || "PUBLISH_FAILED";
      }
    }

    if (Object.keys(postUpdates).length > 0) {
      await prisma.post.update({
        where: { id: post.id },
        data: postUpdates,
      });
    }

    return this.getPost(workspaceId, postId, { skipReconcile: true });
  }
}

export const postsService = new PostsService();
