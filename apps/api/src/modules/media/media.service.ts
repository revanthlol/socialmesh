import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  ALLOWED_MIME_TYPES,
  isSupportedMimeType,
  generateObjectKey,
  createPresignedUploadUrl,
  createPresignedViewUrl,
  checkObjectExists,
  deleteObjectFromR2,
} from "../../lib/r2.js";
import type { RequestUploadUrlInput } from "./media.schemas.js";

export function serializeMediaAsset(asset: any, viewUrl?: string) {
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    kind: asset.kind,
    status: asset.status,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    byteSize: Number(asset.byteSize),
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    altText: asset.altText,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    viewUrl: viewUrl || null,
  };
}

export class MediaService {
  async requestUploadUrl(workspaceId: string, input: RequestUploadUrlInput) {
    if (!isSupportedMimeType(input.mimeType)) {
      const allowed = Object.keys(ALLOWED_MIME_TYPES).join(", ");
      throw AppError.badRequest(
        `Unsupported media type '${input.mimeType}'. Supported types: ${allowed}`,
      );
    }

    const typeConfig = ALLOWED_MIME_TYPES[input.mimeType];
    if (input.byteSize > typeConfig.maxSize) {
      const maxMb = Math.round(typeConfig.maxSize / (1024 * 1024));
      throw AppError.badRequest(
        `File size exceeds maximum allowed size of ${maxMb} MB for ${typeConfig.kind.toLowerCase()}s`,
      );
    }

    const assetId = crypto.randomUUID();
    const objectKey = generateObjectKey(workspaceId, assetId, typeConfig.ext);

    // Create database entry in PENDING_UPLOAD state
    const asset = await prisma.mediaAsset.create({
      data: {
        id: assetId,
        workspaceId,
        kind: typeConfig.kind,
        status: "PENDING_UPLOAD",
        objectKey,
        originalName: input.originalName.trim(),
        mimeType: input.mimeType,
        byteSize: BigInt(input.byteSize),
      },
    });

    const uploadUrl = await createPresignedUploadUrl(
      objectKey,
      input.mimeType,
      input.byteSize,
    );

    return {
      mediaAsset: serializeMediaAsset(asset),
      uploadUrl,
    };
  }

  async confirmUpload(workspaceId: string, mediaId: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    if (asset.status === "READY") {
      const viewUrl = await createPresignedViewUrl(asset.objectKey);
      return serializeMediaAsset(asset, viewUrl);
    }

    // Verify object actually landed in R2
    const check = await checkObjectExists(asset.objectKey);
    if (!check.exists) {
      throw AppError.badRequest(
        "Uploaded file could not be verified in storage. Please re-upload.",
      );
    }

    const updated = await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: "READY",
        byteSize:
          check.size !== undefined ? BigInt(check.size) : asset.byteSize,
      },
    });

    const viewUrl = await createPresignedViewUrl(updated.objectKey);
    return serializeMediaAsset(updated, viewUrl);
  }

  async listMedia(
    workspaceId: string,
    options: {
      kind?: "IMAGE" | "VIDEO" | undefined;
      limit?: number | undefined;
    },
  ) {
    const where: any = {
      workspaceId,
      deletedAt: null,
    };

    if (options.kind) {
      where.kind = options.kind;
    }

    const assets = await prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
    });

    // Attach signed view URLs for READY assets
    const serialized = await Promise.all(
      assets.map(async (asset) => {
        let viewUrl: string | undefined;
        if (asset.status === "READY") {
          try {
            viewUrl = await createPresignedViewUrl(asset.objectKey);
          } catch {
            // Silently fall back if presigning error occurs
          }
        }
        return serializeMediaAsset(asset, viewUrl);
      }),
    );

    return serialized;
  }

  async getMedia(workspaceId: string, mediaId: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    let viewUrl: string | undefined;
    if (asset.status === "READY") {
      viewUrl = await createPresignedViewUrl(asset.objectKey);
    }

    return serializeMediaAsset(asset, viewUrl);
  }

  async deleteMedia(workspaceId: string, mediaId: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        posts: true,
      },
    });

    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    // Attempt deleting object from Cloudflare R2
    try {
      await deleteObjectFromR2(asset.objectKey);
    } catch {
      // Continue even if already removed from bucket
    }

    // Soft delete media asset record
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }
}

export const mediaService = new MediaService();
