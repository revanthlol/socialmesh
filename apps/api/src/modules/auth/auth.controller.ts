import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import {
  setSessionCookie,
  clearSessionCookie,
  extractSessionToken,
} from "../../middleware/auth.js";

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const meta: { userAgent?: string; ip?: string } = {};
      const userAgent = req.headers["user-agent"];
      const ip = req.ip || req.socket.remoteAddress;
      if (userAgent) meta.userAgent = userAgent;
      if (ip) meta.ip = ip;

      const result = await authService.register(req.body, meta);
      setSessionCookie(res, result.sessionToken, result.session.expiresAt);

      res.status(201).json({
        data: {
          user: result.user,
          workspace: result.workspace,
          session: result.session,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const meta: { userAgent?: string; ip?: string } = {};
      const userAgent = req.headers["user-agent"];
      const ip = req.ip || req.socket.remoteAddress;
      if (userAgent) meta.userAgent = userAgent;
      if (ip) meta.ip = ip;

      const result = await authService.login(req.body, meta);
      setSessionCookie(res, result.sessionToken, result.session.expiresAt);

      res.status(200).json({
        data: {
          user: result.user,
          workspaces: result.workspaces,
          session: result.session,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = extractSessionToken(req);
      if (token) {
        await authService.logout(token);
      }
      clearSessionCookie(res);

      res.status(200).json({
        data: {
          success: true,
          message: "Logged out successfully",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) {
        await authService.logoutAll(req.user.id);
      }
      clearSessionCookie(res);

      res.status(200).json({
        data: {
          success: true,
          message: "All active sessions revoked",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.getMe(req.user!.id);
      res.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
