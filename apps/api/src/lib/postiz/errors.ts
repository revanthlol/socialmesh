/**
 * Base error class for all Postiz client errors.
 */
export class PostizError extends Error {
  public readonly statusCode?: number | undefined;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    options: {
      code?: string | undefined;
      statusCode?: number | undefined;
      details?: unknown;
      isRetryable?: boolean | undefined;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "PostizError";
    this.code = options.code ?? "POSTIZ_ERROR";
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.isRetryable = options.isRetryable ?? false;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PostizAuthenticationError extends PostizError {
  constructor(
    message = "Unauthorized: Invalid or missing Postiz API key",
    statusCode = 401,
    details?: unknown,
  ) {
    super(message, {
      code: "POSTIZ_AUTHENTICATION_ERROR",
      statusCode,
      details,
      isRetryable: false,
    });
    this.name = "PostizAuthenticationError";
  }
}

export class PostizNotFoundError extends PostizError {
  constructor(resource: string, details?: unknown) {
    super(`Postiz resource not found: ${resource}`, {
      code: "POSTIZ_NOT_FOUND",
      statusCode: 404,
      details,
      isRetryable: false,
    });
    this.name = "PostizNotFoundError";
  }
}

export class PostizValidationError extends PostizError {
  constructor(message: string, details?: unknown) {
    super(message, {
      code: "POSTIZ_VALIDATION_ERROR",
      statusCode: 400,
      details,
      isRetryable: false,
    });
    this.name = "PostizValidationError";
  }
}

export class PostizRateLimitError extends PostizError {
  public readonly retryAfterSeconds?: number | undefined;

  constructor(
    message = "Postiz API rate limit exceeded",
    retryAfterSeconds?: number | undefined,
    details?: unknown,
  ) {
    super(message, {
      code: "POSTIZ_RATE_LIMIT",
      statusCode: 429,
      details,
      isRetryable: true,
    });
    this.name = "PostizRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PostizServerError extends PostizError {
  constructor(
    message = "Postiz internal server error",
    statusCode = 500,
    details?: unknown,
  ) {
    super(message, {
      code: "POSTIZ_SERVER_ERROR",
      statusCode,
      details,
      isRetryable: true,
    });
    this.name = "PostizServerError";
  }
}

export class PostizTimeoutError extends PostizError {
  constructor(timeoutMs: number, url: string) {
    super(`Postiz request to ${url} timed out after ${timeoutMs}ms`, {
      code: "POSTIZ_TIMEOUT",
      isRetryable: true,
    });
    this.name = "PostizTimeoutError";
  }
}

export class PostizNetworkError extends PostizError {
  constructor(message: string, cause?: unknown) {
    super(`Postiz network error: ${message}`, {
      code: "POSTIZ_NETWORK_ERROR",
      isRetryable: true,
      cause,
    });
    this.name = "PostizNetworkError";
  }
}
