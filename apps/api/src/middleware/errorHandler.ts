import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = (req as any).id || (req.headers["x-request-id"] as string | undefined);

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      req.log?.error?.(err, "Application server error");
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  // Handle SyntaxError from malformed JSON body
  if (err instanceof SyntaxError && "status" in err && (err as any).status === 400 && "body" in err) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON payload in request body",
        requestId,
      },
    });
    return;
  }

  // Unexpected errors
  req.log?.error?.(err, "Unhandled error occurred");

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred",
      requestId,
    },
  });
};
