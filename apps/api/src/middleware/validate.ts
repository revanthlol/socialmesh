import type { Request, Response, NextFunction } from "express";
import { type ZodType, ZodError } from "zod";
import { AppError } from "../lib/errors.js";

interface ValidationTargets {
  body?: ZodType<unknown>;
  query?: ZodType<unknown>;
  params?: ZodType<unknown>;
}

export function validate(targets: ValidationTargets) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (targets.body) {
        req.body = await targets.body.parseAsync(req.body);
      }
      if (targets.query) {
        const parsed = (await targets.query.parseAsync(req.query)) as Record<string, any>;
        // In Express 5 req.query has only a getter; copy parsed properties onto it
        if (req.query && typeof req.query === "object") {
          Object.assign(req.query, parsed);
        }
      }
      if (targets.params) {
        const parsed = (await targets.params.parseAsync(req.params)) as Record<string, any>;
        if (req.params && typeof req.params === "object") {
          Object.assign(req.params, parsed);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = (error as any).issues?.map((issue: any) => ({
          path: issue.path.join("."),
          message: issue.message,
        })) || [];
        next(new AppError(400, "VALIDATION_ERROR", "Request validation failed", details));
      } else {
        next(error);
      }
    }
  };
}
