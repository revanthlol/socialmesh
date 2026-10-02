import type { Request, Response, NextFunction } from "express";
import { channelsService } from "./channels.service.js";
import { getParam } from "../../lib/params.js";
import { env } from "../../config/env.js";

export class ChannelsController {
  async listAssigned(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const channels = await channelsService.listWorkspaceChannels(workspaceId);
      res.status(200).json({ data: channels });
    } catch (error) {
      next(error);
    }
  }

  async listAvailable(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const result = await channelsService.listAvailableChannels(workspaceId);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const channel = await channelsService.assignChannel(
        workspaceId,
        req.body,
      );
      res.status(201).json({ data: channel });
    } catch (error) {
      next(error);
    }
  }

  async removeAssignment(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const channelId = getParam(req, "channelId");
      await channelsService.removeChannelAssignment(workspaceId, channelId);
      res.status(200).json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const channelId = getParam(req, "channelId");
      await channelsService.disconnectChannel(workspaceId, channelId);
      res.status(200).json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const channelId = getParam(req, "channelId");
      const days = req.query.days ? Number(req.query.days) : 30;
      const result = await channelsService.getChannelAnalytics(
        workspaceId,
        channelId,
        days,
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getConnectUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const userId = (req as any).user.id;
      const result = await channelsService.startOAuthConnection(
        workspaceId,
        userId,
        req.body.provider,
      );
      res.cookie("sm_oauth_pending", result.stateToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async resolvePending(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const state = req.body?.state || (req.query?.state as string);
      const stateToken =
        req.body?.stateToken ||
        (state ? undefined : req.cookies?.sm_oauth_pending);
      const code = req.body?.code || (req.query?.code as string);
      const provider = req.body?.provider || (req.query?.provider as string);
      const timezone = req.body?.timezone || (req.query?.timezone as string);
      const pageId = req.body?.pageId || (req.query?.pageId as string);

      const result = await channelsService.resolvePendingConnection(userId, {
        stateToken,
        state,
        code,
        provider,
        timezone,
        pageId,
      });
      res.clearCookie("sm_oauth_pending");
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const channelsController = new ChannelsController();
