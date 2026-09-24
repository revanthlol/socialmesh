import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { getParam } from "../lib/params.js";
import type { WorkspaceRole } from "../generated/prisma/enums.js";

export interface WorkspaceMembershipInfo {
  id: string;
  role: WorkspaceRole;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  timezone: string;
}

declare global {
  namespace Express {
    interface Request {
      workspace?: WorkspaceInfo;
      membership?: WorkspaceMembershipInfo;
    }
  }
}

export function requireWorkspaceMember(paramName = "workspaceId") {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const workspaceId = getParam(req, paramName);
      if (!workspaceId) {
        throw AppError.badRequest("Workspace ID is required");
      }

      const membership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.user.id,
            workspaceId,
          },
        },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              timezone: true,
            },
          },
        },
      });

      if (!membership) {
        throw AppError.forbidden("You are not a member of this workspace");
      }

      req.workspace = membership.workspace;
      req.membership = {
        id: membership.id,
        role: membership.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireWorkspaceRole(allowedRoles: WorkspaceRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.membership) {
      next(AppError.forbidden("Workspace membership verification required"));
      return;
    }

    if (!allowedRoles.includes(req.membership.role)) {
      next(
        AppError.forbidden(
          `This action requires one of the following roles: ${allowedRoles.join(", ")}`,
        ),
      );
      return;
    }

    next();
  };
}
