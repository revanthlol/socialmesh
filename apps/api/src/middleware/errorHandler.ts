import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import { AppError } from "../lib/errors.js";
import {
  PostizError,
  PostizAuthenticationError,
  PostizValidationError,
  PostizRateLimitError,
  PostizTimeoutError,
  PostizNotFoundError,
} from "../lib/postiz/errors.js";

export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return "Publishing failed";
  return msg
    .replace(
      /(access_token|client_secret|code|password|secret|key)=([^& \n]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED]")
    .replace(/X-Amz-Signature=[0-9a-fA-F]+/g, "X-Amz-Signature=[REDACTED]")
    .replace(/X-Amz-Credential=[^& \n]+/g, "X-Amz-Credential=[REDACTED]")
    .replace(/sm_session=[A-Za-z0-9]+/g, "sm_session=[REDACTED]");
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId =
    (req as any).id || (req.headers["x-request-id"] as string | undefined);

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      req.log?.error?.(err, "Application server error");
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: sanitizeErrorMessage(err.message),
        details: err.details,
        requestId,
      },
    });
    return;
  }

  // Handle Postiz engine errors safely without exposing provider credentials or raw tokens
  if (err instanceof PostizError) {
    let statusCode = err.statusCode || 502;
    let code = err.code || "PUBLISHING_ENGINE_ERROR";
    let message = sanitizeErrorMessage(err.message);

    if (err instanceof PostizAuthenticationError) {
      statusCode = 502;
      code = "PROVIDER_CREDENTIALS_UNAVAILABLE";
      message = "Social publishing engine authentication failed";
    } else if (err instanceof PostizValidationError) {
      statusCode = 400;
      code = "PROVIDER_VALIDATION_ERROR";
    } else if (err instanceof PostizRateLimitError) {
      statusCode = 429;
      code = "PROVIDER_RATE_LIMIT";
      message = "Social provider rate limit reached. Please try again later.";
    } else if (err instanceof PostizTimeoutError) {
      statusCode = 504;
      code = "PROVIDER_TIMEOUT";
      message = "Social publishing engine request timed out";
    } else if (err instanceof PostizNotFoundError) {
      statusCode = 404;
      code = "PROVIDER_RESOURCE_NOT_FOUND";
    }

    req.log?.warn?.(
      {
        code,
        statusCode,
        originalMessage: sanitizeErrorMessage(err.message),
        details: err.details,
      },
      "Postiz engine error occurred",
    );

    res.status(statusCode).json({
      error: {
        code,
        message,
        requestId,
      },
    });
    return;
  }

  // Handle SyntaxError from malformed JSON body
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as any).status === 400 &&
    "body" in err
  ) {
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
