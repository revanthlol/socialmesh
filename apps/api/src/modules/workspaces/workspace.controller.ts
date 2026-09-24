import type { Request, Response, NextFunction } from "express";
import { workspaceService } from "./workspace.service.js";
import { getParam } from "../../lib/params.js";

export class WorkspaceController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaces = await workspaceService.listUserWorkspaces(
        req.user!.id,
      );
      res.status(200).json({ data: workspaces });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const workspace = await workspaceService.createWorkspace(
        req.user!.id,
        req.body,
      );
      res.status(201).json({ data: workspace });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const workspace = await workspaceService.getWorkspace(workspaceId);
      res.status(200).json({ data: workspace });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const workspace = await workspaceService.updateWorkspace(
        workspaceId,
        req.body,
      );
      res.status(200).json({ data: workspace });
    } catch (error) {
      next(error);
    }
  }

  async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const members = await workspaceService.listMembers(workspaceId);
      res.status(200).json({ data: members });
    } catch (error) {
      next(error);
    }
  }
}

export const workspaceController = new WorkspaceController();
