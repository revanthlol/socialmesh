import type { Request, Response, NextFunction } from "express";
import { authService } from "../modules/auth/auth.service.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

export const SESSION_COOKIE_NAME = "sm_session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionToken?: string;
      sessionId?: string;
    }
  }
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function extractSessionToken(req: Request): string | null {
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      throw AppError.unauthorized("Authentication required");
    }

    const session = await authService.validateSession(token);
    if (!session) {
      throw AppError.unauthorized("Session expired or invalid");
    }

    req.user = session.user;
    req.sessionId = session.id;
    req.sessionToken = token;
    next();
  } catch (error) {
    next(error);
  }
}
