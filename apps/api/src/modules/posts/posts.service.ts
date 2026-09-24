import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { createPresignedViewUrl } from "../../lib/r2.js";
import type { CreatePostInput, UpdatePostInput } from "./posts.schemas.js";

async function formatPostWithMedia(post: any) {
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
  };
}

export class PostsService {
  async listPosts(workspaceId: string, options: { status?: any; limit?: number | undefined }) {
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
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 20,
    });

    return Promise.all(posts.map(formatPostWithMedia));
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
      },
    });

    if (!post) {
      throw AppError.notFound("Post not found");
    }

    return formatPostWithMedia(post);
  }

  async createDraft(workspaceId: string, userId: string, input: CreatePostInput) {
    const mediaIds = input.mediaAssetIds || [];

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
        throw AppError.badRequest("One or more selected media assets could not be found in this workspace");
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
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
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

      return tx.post.findUnique({
        where: { id: createdPost.id },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
          media: {
            include: { mediaAsset: true },
            orderBy: { position: "asc" },
          },
        },
      });
    });

    return formatPostWithMedia(post!);
  }

  async updateDraft(workspaceId: string, postId: string, input: UpdatePostInput) {
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
      data.scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.mediaAssetIds !== undefined) {
        // Validate media assets
        if (input.mediaAssetIds.length > 0) {
          const count = await tx.mediaAsset.count({
            where: {
              id: { in: input.mediaAssetIds },
              workspaceId,
              deletedAt: null,
            },
          });
          if (count !== input.mediaAssetIds.length) {
            throw AppError.badRequest("One or more selected media assets could not be found");
          }
        }

        // Replace post_media relations
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

      return tx.post.update({
        where: { id: postId },
        data,
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
          media: {
            include: { mediaAsset: true },
            orderBy: { position: "asc" },
          },
        },
      });
    });

    return formatPostWithMedia(updated);
  }

  async deleteDraft(workspaceId: string, postId: string) {
    const existing = await prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!existing) {
      throw AppError.notFound("Post not found");
    }

    if (existing.status !== "DRAFT") {
      throw AppError.badRequest("Only draft posts can be deleted");
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    return { success: true };
  }
}

export const postsService = new PostsService();
