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
  PostizIntegrationSchema,
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
  social: (provider: string) =>
    `/public/v1/social/${encodeURIComponent(provider)}`,
  completeSocial: (provider: string) =>
    `/public/v1/social/${encodeURIComponent(provider)}/complete`,
  integrationById: (id: string) =>
    `/public/v1/integrations/${encodeURIComponent(id)}`,
  posts: "/public/v1/posts",
  postById: (id: string) => `/public/v1/posts/${encodeURIComponent(id)}`,
  uploadFromUrl: "/public/v1/upload-from-url",
  analytics: (integrationId: string, days = 30) =>
    `/public/v1/analytics/${encodeURIComponent(integrationId)}?date=${encodeURIComponent(days)}`,
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
    this.baseUrl = (config.baseUrl ?? env.POSTIZ_BASE_URL ?? "").replace(
      /\/+$/,
      "",
    );
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
    input: (
      | PostizCreateDraftInput
      | PostizSchedulePostInput
      | PostizPublishNowInput
    ) & { date?: string | undefined },
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

    const formattedImages: Array<{ id: string; path: string; alt?: string }> = (
      input.media || []
    )
      .map((item, idx) => {
        if (typeof item === "string") {
          return {
            id: `media-${idx}`,
            path: item,
          };
        }
        const path = item.path || (item as any).url || "";
        return {
          id: item.id || `media-${idx}`,
          path,
          ...((item as any).alt ? { alt: (item as any).alt } : {}),
        };
      })
      .filter((img) => Boolean(img.path));

    const mappedPosts = (input.integrations || []).map((item) => {
      const integrationId = typeof item === "string" ? item : item.id;
      const customContent =
        typeof item === "object" && item.customContent
          ? item.customContent
          : (input.content ?? "");
      const provider =
        typeof item === "object" && item.provider
          ? item.provider.toLowerCase()
          : undefined;

      const itemSettings =
        typeof item === "object" && item.settings
          ? { ...item.settings }
          : {};

      const baseSettings = input.settings ? { ...input.settings } : {};

      const combinedSettings: Record<string, unknown> = {
        ...baseSettings,
        ...itemSettings,
      };

      // Provider-specific default settings required by Postiz DTOs:
      // For Instagram, Postiz's InstagramDto strictly requires post_type: 'post' | 'story'
      // Normal feed publications must specify post_type: 'post'
      if (provider && provider.includes("instagram")) {
        if (!combinedSettings.post_type) {
          combinedSettings.post_type = "post";
        }
      }

      return {
        integration: { id: integrationId },
        value: [{ content: customContent, image: formattedImages }],
        settings: combinedSettings,
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
      ...(formattedImages.length > 0 ? { media: formattedImages } : {}),
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
      throw new PostizValidationError(
        "Postiz base URL is not configured. Set POSTIZ_BASE_URL.",
      );
    }
    if (!this.apiKey) {
      throw new PostizAuthenticationError(
        "Postiz API key is not configured. Set POSTIZ_API_KEY.",
      );
    }

    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    // Safeguard against accidental /api prefix
    if (cleanPath.startsWith("/api/")) {
      throw new PostizValidationError(
        `Direct headless Postiz routes must not include /api prefix: ${cleanPath}`,
      );
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

    if (
      init.body &&
      typeof init.body === "string" &&
      !headers["Content-Type"]
    ) {
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

        const errObj =
          typeof errorBody === "object" && errorBody !== null
            ? (errorBody as Record<string, unknown>)
            : null;
        const rawMsg = errObj?.message ?? errObj?.msg ?? errObj?.error;
        const message =
          (rawMsg !== undefined && rawMsg !== null
            ? Array.isArray(rawMsg)
              ? rawMsg.join(", ")
              : typeof rawMsg === "object" && "message" in (rawMsg as any)
                ? String((rawMsg as any).message)
                : String(rawMsg)
            : undefined) ??
          `Postiz API responded with status ${response.status}`;

        this.logger.warn(
          {
            statusCode: response.status,
            path: cleanPath,
            errorBody,
            extractedMessage: message,
          },
          "Postiz API returned non-OK response",
        );

        if (response.status === 401 || response.status === 403) {
          throw new PostizAuthenticationError(
            message,
            response.status,
            errorBody,
          );
        }

        if (response.status === 404) {
          throw new PostizNotFoundError(cleanPath, errorBody);
        }

        if (response.status === 400 || response.status === 422) {
          throw new PostizValidationError(message, errorBody);
        }

        if (response.status === 429) {
          const retryHeader = response.headers.get("Retry-After");
          const retryAfter = retryHeader
            ? Number.parseInt(retryHeader, 10)
            : undefined;
          throw new PostizRateLimitError(
            message,
            Number.isNaN(retryAfter) ? undefined : retryAfter,
            errorBody,
          );
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

      throw new PostizNetworkError(
        err instanceof Error ? err.message : String(err),
        err,
      );
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
  async listIntegrations(
    options?: PostizRequestOptions,
  ): Promise<PostizIntegration[]> {
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
  async getConnectUrl(
    provider: string,
    redirectUrl?: string,
    options?: PostizRequestOptions,
  ): Promise<string> {
    const query = redirectUrl
      ? `?redirectUrl=${encodeURIComponent(redirectUrl)}`
      : "";
    const data = await this.request(
      `${POSTIZ_DIRECT_ENDPOINTS.social(provider)}${query}`,
      { method: "GET" },
      options,
      PostizConnectUrlResponseSchema,
    );
    return data.url;
  }

  /**
   * Complete an OAuth connection flow with a provider authorization code.
   * Exchanges code for tokens in Postiz and returns the connected integration.
   */
  async completeSocialConnection(
    provider: string,
    payload: {
      code: string;
      state: string;
      timezone?: string | undefined;
      pageId?: string | undefined;
      refresh?: string | undefined;
    },
    options?: PostizRequestOptions,
  ): Promise<PostizIntegration> {
    return this.request(
      POSTIZ_DIRECT_ENDPOINTS.completeSocial(provider),
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      options,
      PostizIntegrationSchema,
    );
  }

  /**
   * Disconnect an active integration by its ID.
   */
  async disconnectIntegration(
    id: string,
    options?: PostizRequestOptions,
  ): Promise<{ success: boolean }> {
    const res = await this.request(
      POSTIZ_DIRECT_ENDPOINTS.integrationById(id),
      { method: "DELETE" },
      options,
      PostizSuccessResponseSchema,
    );
    const isSuccess = res.success !== false && res.deleted !== false;
    return { success: isSuccess };
  }

  /**
   * List scheduled/published posts within a date range.
   */
  async listPosts(
    startDate: string,
    endDate: string,
    options?: PostizRequestOptions,
  ): Promise<PostizPost[]> {
    const query = new URLSearchParams({ startDate, endDate }).toString();
    const result = await this.request(
      `${POSTIZ_DIRECT_ENDPOINTS.posts}?${query}`,
      { method: "GET" },
      options,
      PostizListPostsResponseSchema,
    );
    return Array.isArray(result)
      ? result
      : ((result as { posts: PostizPost[] }).posts ?? []);
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
  async deletePost(
    id: string,
    options?: PostizRequestOptions,
  ): Promise<{ success: boolean }> {
    const res = await this.request(
      POSTIZ_DIRECT_ENDPOINTS.postById(id),
      { method: "DELETE" },
      options,
      PostizSuccessResponseSchema,
    );
    // In Postiz (posts.service.ts:700), DELETE /public/v1/posts/:id returns HTTP 200 with { error: true }
    // upon successfully soft-deleting the post group and cancelling workflows. Non-2xx responses throw.
    // Explicit failure only occurs if res.success === false or res.deleted === false.
    const isSuccess = res.success !== false && res.deleted !== false;
    return { success: isSuccess };
  }

  /**
   * Ingest a media asset from a URL into Postiz.
   */
  async uploadFromUrl(
    url: string,
    options?: PostizRequestOptions,
  ): Promise<PostizUploadFromUrlResponse> {
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

  /**
   * Fetch timeseries analytics for a connected integration.
   */
  async getAnalytics(
    integrationId: string,
    days = 30,
    options?: PostizRequestOptions,
  ): Promise<any> {
    return this.request(
      POSTIZ_DIRECT_ENDPOINTS.analytics(integrationId, days),
      {
        method: "GET",
      },
      options,
    );
  }
}

/**
 * Factory helper to instantiate a configured Postiz client.
 */
export function getPostizClient(
  overrides?: Partial<PostizConfig>,
): PostizClient {
  return new PostizClient(overrides);
}
