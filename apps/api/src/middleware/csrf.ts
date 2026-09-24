import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Validates Origin / Referer on mutating HTTP methods for cookie-authenticated requests.
 */
export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // If there is no session cookie, CSRF does not apply (e.g. public endpoints, non-cookie auth)
  if (!req.cookies?.sm_session) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    ...(env.WEB_BASE_URL ? [env.WEB_BASE_URL] : []),
    ...(env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
      : []),
  ]);

  if (origin) {
    try {
      const parsedOrigin = new URL(origin).origin;
      const isAllowed = Array.from(allowedOrigins).some((allowed) => {
        try {
          return new URL(allowed).origin === parsedOrigin;
        } catch {
          return false;
        }
      });

      if (!isAllowed) {
        return next(
          AppError.forbidden(
            `Cross-origin request blocked: origin ${origin} is not allowed`,
          ),
        );
      }
      return next();
    } catch {
      return next(AppError.forbidden("Invalid Origin header"));
    }
  }

  if (referer) {
    try {
      const parsedRefererOrigin = new URL(referer).origin;
      const isAllowed = Array.from(allowedOrigins).some((allowed) => {
        try {
          return new URL(allowed).origin === parsedRefererOrigin;
        } catch {
          return false;
        }
      });

      if (!isAllowed) {
        return next(
          AppError.forbidden(
            `Cross-origin request blocked: referer ${referer} is not allowed`,
          ),
        );
      }
      return next();
    } catch {
      return next(AppError.forbidden("Invalid Referer header"));
    }
  }

  // Allow in test environment (where fetch/supertest often omits Origin)
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  return next(
    AppError.forbidden(
      "Missing Origin or Referer header on cookie-authenticated mutating request",
    ),
  );
}
