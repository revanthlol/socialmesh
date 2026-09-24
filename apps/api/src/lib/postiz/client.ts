import pino from "pino";
import type { ZodType } from "zod";
import { env } from "../../config/env.js";
import {
  PostizAuthenticationError,
  PostizError,
  PostizNetworkError,
  PostizNotFoundError,
  PostizRateLimitError,
  PostizServerError,
  PostizTimeoutError,
  PostizValidationError,
} from "./errors.js";
import {
  type PostizConfig,
  type PostizConnectUrlResponse,
  PostizConnectUrlResponseSchema,
  type PostizCreateDraftInput,
  type PostizCreatePostResponse,
  PostizCreatePostResponseSchema,
  type PostizIntegration,
  PostizIsConnectedResponseSchema,
  type PostizListIntegrationsResponse,
  PostizListIntegrationsResponseSchema,
  type PostizListPostsResponse,
  PostizListPostsResponseSchema,
  type PostizPost,
  type PostizPublishNowInput,
  type PostizRequestOptions,
  type PostizSchedulePostInput,
  type PostizSuccessResponse,
  PostizSuccessResponseSchema,
  type PostizUploadFromUrlResponse,
  PostizUploadFromUrlResponseSchema,
} from "./types.js";

const defaultLogger = pino({
  name: "postiz-client",
  level: env.NODE_ENV === "test" ? "silent" : "info",
});

/**
 * Direct headless Postiz API routes (NestJS without Nginx proxy).
 */
export const POSTIZ_DIRECT_ENDPOINTS = {
  isConnected: "/public/v1/is-connected",
  integrations: "/public/v1/integrations",
  social: (provider: string) => `/public/v1/social/${encodeURIComponent(provider)}`,
  integrationById: (id: string) => `/public/v1/integrations/${encodeURIComponent(id)}`,
  posts: "/public/v1/posts",
  postById: (id: string) => `/public/v1/posts/${encodeURIComponent(id)}`,
  uploadFromUrl: "/public/v1/upload-from-url",
} as const;

/**
 * Encapsulated Postiz API client adapter for SociaMesh.
 * Directly communicates with the headless Postiz NestJS REST backend.
 */
export class PostizClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly organizationId?: string | undefined;
  private readonly logger: pino.Logger;

  constructor(config: Partial<PostizConfig> = {}, logger?: pino.Logger) {
    this.baseUrl = (config.baseUrl ?? env.POSTIZ_BASE_URL ?? "http://localhost:4008").replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? env.POSTIZ_API_KEY ?? "";
    this.timeoutMs = config.timeoutMs ?? env.POSTIZ_TIMEOUT_MS ?? 10000;
    this.organizationId = config.organizationId;
    this.logger = logger ?? defaultLogger;
  }

  /**
   * Constructs the post payload supporting headless NestJS post validation.
   */
  private buildPostPayload(
    type: "draft" | "schedule" | "now",
    input: (PostizCreateDraftInput | PostizSchedulePostInput | PostizPublishNowInput) & { date?: string | undefined },
  ): Record<string, unknown> {
    const raw = input as any;
    if (Array.isArray(raw.posts)) {
      return {
        type,
        date: input.date ?? new Date().toISOString(),
        shortLink: false,
        tags: [],
        ...raw,
      };
    }

    const mappedPosts = (input.integrations || []).map((item) => {
      const integrationId = typeof item === "string" ? item : item.id;
      const customContent = typeof item === "object" && item.customContent ? item.customContent : input.content ?? "";
      return {
        integration: { id: integrationId },
        value: [{ content: customContent, image: [] }],
        settings: input.settings ?? {},
      };
    });

    return {
      type,
      date: input.date ?? new Date().toISOString(),
      shortLink: false,
      tags: [],
      content: input.content,
      integrations: input.integrations,
      posts: mappedPosts,
      media: input.media,
      settings: input.settings,
    };
  }

  /**
   * Internal HTTP request dispatcher with timeouts, error mapping, and response validation.
   */
  private async request<T>(
    path: string,
    init: RequestInit,
    options?: PostizRequestOptions,
    schema?: ZodType<T>,
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new PostizValidationError("Postiz base URL is not configured. Set POSTIZ_BASE_URL.");
    }
    if (!this.apiKey) {
      throw new PostizAuthenticationError("Postiz API key is not configured. Set POSTIZ_API_KEY.");
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    // Safeguard against accidental /api prefix
    if (cleanPath.startsWith("/api/")) {
      throw new PostizValidationError(`Direct headless Postiz routes must not include /api prefix: ${cleanPath}`);
    }

    const url = `${this.baseUrl}${cleanPath}`;
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const orgId = options?.organizationId ?? this.organizationId;

    const controller = new AbortController();

    const headers: Record<string, string> = {
      Authorization: this.apiKey,
      Accept: "application/json",
      ...(init.headers as Record<string, string>),
    };

    if (init.body && typeof init.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (orgId) {
      headers["x-postiz-org"] = orgId;
    }

    // Sanitized logging: headers logged without Authorization or secrets
    const sanitizedHeaders = { ...headers };
    if (sanitizedHeaders.Authorization) {
      sanitizedHeaders.Authorization = "******";
    }

    this.logger.debug(
      {
        method: init.method ?? "GET",
        url,
        headers: sanitizedHeaders,
      },
      "Dispatching Postiz API request",
    );

    let timeoutId: NodeJS.Timeout | undefined;
    let didTimeout = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        reject(new PostizTimeoutError(timeoutMs, cleanPath));
      }, timeoutMs);
    });

    // Handle caller abort signal
    const onCallerAbort = () => {
      controller.abort();
    };
    if (options?.signal) {
      options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      const fetchPromise = fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (timeoutId) clearTimeout(timeoutId);

      // Handle HTTP error statuses
      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          try {
            errorBody = await response.text();
          } catch {
            errorBody = null;
          }
        }

        const message =
          (typeof errorBody === "object" && errorBody !== null && "message" in errorBody
            ? Array.isArray((errorBody as { message: unknown }).message)
              ? (errorBody as { message: unknown[] }).message.join(", ")
              : String((errorBody as { message: unknown }).message)
            : undefined) ?? `Postiz API responded with status ${response.status}`;

        if (response.status === 401 || response.status === 403) {
          throw new PostizAuthenticationError(message, response.status, errorBody);
        }

        if (response.status === 404) {
          throw new PostizNotFoundError(cleanPath, errorBody);
        }

        if (response.status === 400 || response.status === 422) {
          throw new PostizValidationError(message, errorBody);
        }

        if (response.status === 429) {
          const retryHeader = response.headers.get("Retry-After");
          const retryAfter = retryHeader ? Number.parseInt(retryHeader, 10) : undefined;
          throw new PostizRateLimitError(message, Number.isNaN(retryAfter) ? undefined : retryAfter, errorBody);
        }

        if (response.status >= 500) {
          throw new PostizServerError(message, response.status, errorBody);
        }

        throw new PostizError(message, {
          statusCode: response.status,
          details: errorBody,
        });
      }

      // Handle empty body responses (e.g. 204 No Content)
      if (response.status === 204) {
        return { success: true } as unknown as T;
      }

      const rawJson = await response.json();

      // Validate response against schema if provided
      if (schema) {
        const parseResult = schema.safeParse(rawJson);
        if (!parseResult.success) {
          this.logger.warn(
            { issues: parseResult.error.issues, path: cleanPath },
            "Postiz response failed schema validation",
          );
          throw new PostizValidationError(
            `Postiz response failed schema validation: ${parseResult.error.message}`,
            parseResult.error.issues,
          );
        }
        return parseResult.data;
      }

      return rawJson as T;
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);

      if (didTimeout || err instanceof PostizTimeoutError) {
        throw err;
      }

      if (err instanceof PostizError) {
        throw err;
      }

      if (err instanceof Error && err.name === "AbortError") {
        if (options?.signal?.aborted) {
          throw new PostizError("Postiz request was aborted by caller", {
            code: "POSTIZ_ABORTED",
            cause: err,
          });
        }
        throw new PostizTimeoutError(timeoutMs, cleanPath);
      }

      throw new PostizNetworkError(err instanceof Error ? err.message : String(err), err);
    } finally {
      if (options?.signal) {
        options.signal.removeEventListener("abort", onCallerAbort);
      }
    }
  }

  /**
   * Health and authentication verification.
   * Returns true if Postiz is reachable and the API key is accepted.
   */
  async isConnected(options?: PostizRequestOptions): Promise<boolean> {
    if (!this.apiKey || !this.baseUrl) {
      return false;
    }
    try {
      await this.request(
        POSTIZ_DIRECT_ENDPOINTS.isConnected,
        { method: "GET" },
        options,
        PostizIsConnectedResponseSchema,
      );
      return true;
    } catch (err: unknown) {
      this.logger.debug({ err }, "Postiz isConnected check failed");
      return false;
    }
  }

  /**
   * List all connected social channels/integrations for the organization.
   */
  async listIntegrations(options?: PostizRequestOptions): Promise<PostizIntegration[]> {
    return this.request(
      POSTIZ_DIRECT_ENDPOINTS.integrations,
      { method: "GET" },
      options,
      PostizListIntegrationsResponseSchema,
    );
  }

  /**
   * Initiate OAuth connection for a social provider.
   * Returns the external provider authorization URL.
   */
  async getConnectUrl(provider: string, options?: PostizRequestOptions): Promise<string> {
    const data = await this.request(
      POSTIZ_DIRECT_ENDPOINTS.social(provider),
      { method: "GET" },
      options,
      PostizConnectUrlResponseSchema,
    );
    return data.url;
  }

  /**
   * Disconnect an active integration by its ID.
   */
  async disconnectIntegration(id: string, options?: PostizRequestOptions): Promise<{ success: boolean }> {
    const res = await this.request(
      POSTIZ_DIRECT_ENDPOINTS.integrationById(id),
      { method: "DELETE" },
      options,
      PostizSuccessResponseSchema,
    );
    return { success: res.success ?? res.deleted ?? !res.error };
  }

  /**
   * List scheduled/published posts within a date range.
   */
  async listPosts(startDate: string, endDate: string, options?: PostizRequestOptions): Promise<PostizPost[]> {
    const query = new URLSearchParams({ startDate, endDate }).toString();
    const result = await this.request(
      `${POSTIZ_DIRECT_ENDPOINTS.posts}?${query}`,
      { method: "GET" },
      options,
      PostizListPostsResponseSchema,
    );
    return Array.isArray(result) ? result : (result as { posts: PostizPost[] }).posts ?? [];
  }

  /**
   * Create a post draft in Postiz.
   */
  async createDraft(
    input: PostizCreateDraftInput,
    options?: PostizRequestOptions,
  ): Promise<PostizCreatePostResponse> {
    const payload = this.buildPostPayload("draft", input);
    return this.request(
      POSTIZ_DIRECT_ENDPOINTS.posts,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      options,
      PostizCreatePostResponseSchema,
    );
  }

  /**
   * Schedule a post for future publishing via Temporal durable timer.
   */
  async schedulePost(
    input: PostizSchedulePostInput,
    options?: PostizRequestOptions,
  ): Promise<PostizCreatePostResponse> {
    const payload = this.buildPostPayload("schedule", input);
    return this.request(
      POSTIZ_DIRECT_ENDPOINTS.posts,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      options,
      PostizCreatePostResponseSchema,
    );
  }

  /**
   * Immediately publish a post through Postiz workers.
   */
  async publishNow(
    input: PostizPublishNowInput,
    options?: PostizRequestOptions,
  ): Promise<PostizCreatePostResponse> {
    const payload = this.buildPostPayload("now", input);
    return this.request(
      POSTIZ_DIRECT_ENDPOINTS.posts,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      options,
      PostizCreatePostResponseSchema,
    );
  }

  /**
   * Cancel and delete a post in Postiz. Terminates running Temporal workflows.
   */
  async deletePost(id: string, options?: PostizRequestOptions): Promise<{ success: boolean }> {
    const res = await this.request(
      POSTIZ_DIRECT_ENDPOINTS.postById(id),
      { method: "DELETE" },
      options,
      PostizSuccessResponseSchema,
    );
    return { success: res.success ?? res.deleted ?? !res.error };
  }

  /**
   * Ingest a media asset from a URL into Postiz.
   */
  async uploadFromUrl(url: string, options?: PostizRequestOptions): Promise<PostizUploadFromUrlResponse> {
    return this.request(
      POSTIZ_DIRECT_ENDPOINTS.uploadFromUrl,
      {
        method: "POST",
        body: JSON.stringify({ url }),
      },
      options,
      PostizUploadFromUrlResponseSchema,
    );
  }
}

/**
 * Factory helper to instantiate a configured Postiz client.
 */
export function getPostizClient(overrides?: Partial<PostizConfig>): PostizClient {
  return new PostizClient(overrides);
}
