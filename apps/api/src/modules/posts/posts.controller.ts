import type { Request, Response, NextFunction } from "express";
import { postsService } from "./posts.service.js";
import { getParam } from "../../lib/params.js";

export class PostsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const status = req.query.status as any;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const posts = await postsService.listPosts(workspaceId, { status, limit });
      res.status(200).json({ data: posts });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const postId = getParam(req, "postId");
      const post = await postsService.getPost(workspaceId, postId);
      res.status(200).json({ data: post });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const post = await postsService.createDraft(workspaceId, req.user!.id, req.body);
      res.status(201).json({ data: post });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const postId = getParam(req, "postId");
      const post = await postsService.updateDraft(workspaceId, postId, req.body);
      res.status(200).json({ data: post });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const workspaceId = getParam(req, "workspaceId");
      const postId = getParam(req, "postId");
      await postsService.deleteDraft(workspaceId, postId);
      res.status(200).json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
}

export const postsController = new PostsController();
