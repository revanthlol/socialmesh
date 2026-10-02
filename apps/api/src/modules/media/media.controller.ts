import type { Request, Response, NextFunction } from "express";
import { mediaService } from "./media.service.js";
import { getParam } from "../../lib/params.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import {
  verifyDurableMediaToken,
  createPresignedViewUrl,
  getMediaObjectStream,
} from "../../lib/r2.js";

export class MediaController {
  async requestUploadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const result = await mediaService.requestUploadUrl(workspaceId, req.body);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async confirmUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const mediaId = getParam(req, "mediaId");
      const asset = await mediaService.confirmUpload(workspaceId, mediaId);
      res.status(200).json({ data: asset });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const kind = req.query.kind as "IMAGE" | "VIDEO" | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const assets = await mediaService.listMedia(workspaceId, { kind, limit });
      res.status(200).json({ data: assets });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const mediaId = getParam(req, "mediaId");
      const asset = await mediaService.getMedia(workspaceId, mediaId);
      res.status(200).json({ data: asset });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const mediaId = getParam(req, "mediaId");
      await mediaService.deleteMedia(workspaceId, mediaId);
      res.status(200).json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public signature-verified durable media resolution endpoint.
   * Resolves long-future scheduled media into fresh short-lived presigned URLs or streams bytes.
   */
  async serveDurableMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const rawToken = req.params.token;
      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
      if (!token || typeof token !== "string") {
        throw AppError.badRequest("Missing media token");
      }

      const payload = verifyDurableMediaToken(token);
      if (!payload) {
        throw AppError.forbidden("Invalid or expired media token");
      }

      const asset = await prisma.mediaAsset.findFirst({
        where: {
          id: payload.mediaAssetId,
          workspaceId: payload.workspaceId,
          status: "READY",
          deletedAt: null,
        },
      });

      if (!asset) {
        throw AppError.notFound("Media asset not found or no longer available");
      }

      if (req.query.stream === "1" || req.query.stream === "true") {
        const streamData = await getMediaObjectStream(asset.objectKey);
        res.setHeader("Content-Type", asset.mimeType);
        if (streamData.contentLength) {
          res.setHeader("Content-Length", streamData.contentLength);
        }
        res.setHeader("Cache-Control", "private, max-age=3600");
        if (
          streamData.body &&
          typeof (streamData.body as any).pipe === "function"
        ) {
          (streamData.body as any).pipe(res);
          return;
        }
      }

      const freshPresignedUrl = await createPresignedViewUrl(
        asset.objectKey,
        3600,
      );
      res.redirect(302, freshPresignedUrl);
    } catch (error) {
      next(error);
    }
  }
}

export const mediaController = new MediaController();

