import type { Request, Response, NextFunction } from "express";
import { mediaService } from "./media.service.js";
import { getParam } from "../../lib/params.js";

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
}

export const mediaController = new MediaController();
