import {
  PostizClient,
  getPostizClient,
  type PostizIntegration,
  type PostizIntegrationTarget,
  type PostizPost,
  type PostizCreatePostResponse,
  type PostizUploadFromUrlResponse,
} from "../lib/postiz/index.js";

/**
 * Normalized channel definition exposed to SociaMesh domains.
 */
export interface NormalizedChannel {
  id: string;
  provider: string; // e.g. "linkedin-page", "facebook", "instagram", "devto", "x"
  name: string;
  pictureUrl?: string | null | undefined;
  isActive: boolean;
}

export interface PublishMediaItem {
  id: string;
  url: string;
  alt?: string | undefined;
}

export interface PublishChannelTarget {
  channelId: string;
  provider?: string | undefined;
  customContent?: string | undefined;
  settings?: Record<string, unknown> | undefined;
}

/**
 * Input for creating a draft in the publishing engine.
 */
export interface PublishDraftInput {
  content: string;
  channelIds?: string[];
  targets?: PublishChannelTarget[];
  channels?: Array<{
    id?: string;
    postizIntegrationId?: string;
    channelId?: string;
    provider?: string;
  }>;
  mediaUrls?: string[] | undefined;
  media?: PublishMediaItem[] | undefined;
  title?: string | undefined;
  settings?: Record<string, unknown> | undefined;
}

/**
 * Input for scheduling a post in the publishing engine.
 */
export interface SchedulePostInput extends PublishDraftInput {
  scheduledAt: Date | string;
}

/**
 * Input for immediately publishing a post.
 */
export interface PublishNowInput extends PublishDraftInput {}

/**
 * Normalized result of an engine publishing action.
 */
export interface EnginePostResult {
  enginePostId: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  scheduledFor?: string | undefined;
  channelResults?:
    | {
        channelId: string;
        enginePostId: string;
      }[]
    | undefined;
}

/**
 * Normalized media asset ingested by the engine.
 */
export interface NormalizedMediaAsset {
  id: string;
  url: string;
  name?: string | undefined;
  mimeType?: string | undefined;
}

/**
 * Engine invocation options.
 */
export interface EngineOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  organizationId?: string | undefined;
}

/**
 * High-level SociaMesh publishing engine contract.
 * Decouples SociaMesh business logic from specific provider/engine HTTP payloads.
 */
export interface EnginePostStatusResult {
  enginePostId: string;
  state: "PUBLISHED" | "ERROR" | "QUEUE" | "DRAFT" | "UNKNOWN";
  releaseUrl?: string | null;
  releaseId?: string | null;
  error?: string | null;
}

export interface NormalizedAnalyticsMetric {
  label: string;
  total: number;
  percentageChange: number | null;
  data: Array<{ date: string; total: number }>;
}

export interface NormalizedChannelAnalytics {
  available: boolean;
  days: number;
  metrics: NormalizedAnalyticsMetric[];
  reason?: string;
}

export interface PublishingEngine {
  isHealthy(options?: EngineOptions): Promise<boolean>;
  listChannels(options?: EngineOptions): Promise<NormalizedChannel[]>;
  getChannelConnectUrl(
    provider: string,
    redirectUrl?: string,
    options?: EngineOptions,
  ): Promise<string>;
  completeOAuth(
    provider: string,
    payload: {
      code: string;
      state: string;
      timezone?: string | undefined;
      pageId?: string | undefined;
    },
    options?: EngineOptions,
  ): Promise<NormalizedChannel>;
  disconnectChannel(
    channelId: string,
    options?: EngineOptions,
  ): Promise<boolean>;
  createDraft(
    input: PublishDraftInput,
    options?: EngineOptions,
  ): Promise<EnginePostResult>;
  schedulePost(
    input: SchedulePostInput,
    options?: EngineOptions,
  ): Promise<EnginePostResult>;
  publishNow(
    input: PublishNowInput,
    options?: EngineOptions,
  ): Promise<EnginePostResult>;
  cancelPost(enginePostId: string, options?: EngineOptions): Promise<boolean>;
  getPostStatus(
    enginePostId: string,
    approxDate?: Date,
    options?: EngineOptions,
  ): Promise<EnginePostStatusResult | null>;
  importMedia(
    mediaUrl: string,
    options?: EngineOptions,
  ): Promise<NormalizedMediaAsset>;
  getChannelAnalytics(
    integrationId: string,
    days?: number,
    options?: EngineOptions,
  ): Promise<NormalizedChannelAnalytics>;
}

/**
 * Postiz implementation of the SociaMesh PublishingEngine.
 */
export class PostizPublishingEngine implements PublishingEngine {
  constructor(private readonly client: PostizClient = getPostizClient()) {}

  async isHealthy(options?: EngineOptions): Promise<boolean> {
    return this.client.isConnected(options);
  }

  async listChannels(options?: EngineOptions): Promise<NormalizedChannel[]> {
    const integrations = await this.client.listIntegrations(options);
    return integrations.map((item) => ({
      id: item.id,
      provider: item.identifier,
      name: item.name,
      pictureUrl: item.picture ?? null,
      isActive: !item.disabled,
    }));
  }

  async getChannelConnectUrl(
    provider: string,
    redirectUrl?: string,
    options?: EngineOptions,
  ): Promise<string> {
    return this.client.getConnectUrl(provider, redirectUrl, options);
  }

  async completeOAuth(
    provider: string,
    payload: {
      code: string;
      state: string;
      timezone?: string | undefined;
      pageId?: string | undefined;
    },
    options?: EngineOptions,
  ): Promise<NormalizedChannel> {
    const integration = await this.client.completeSocialConnection(
      provider,
      payload,
      options,
    );
    return {
      id: integration.id,
      provider: integration.identifier,
      name: integration.name,
      pictureUrl: integration.picture ?? null,
      isActive: !integration.disabled,
    };
  }

  async disconnectChannel(
    channelId: string,
    options?: EngineOptions,
  ): Promise<boolean> {
    const res = await this.client.disconnectIntegration(channelId, options);
    return res.success;
  }

  private resolveMediaPayload(input: PublishDraftInput) {
    if (input.media && input.media.length > 0) {
      return input.media.map((m) => ({
        id: m.id,
        path: m.url,
        ...(m.alt ? { alt: m.alt } : {}),
      }));
    }
    if (input.mediaUrls && input.mediaUrls.length > 0) {
      return input.mediaUrls.map((url, idx) => ({
        id: `media-${idx}`,
        path: url,
      }));
    }
    return undefined;
  }

  private resolveIntegrationTargets(
    input: PublishDraftInput,
  ): Array<string | PostizIntegrationTarget> {
    if (input.targets && input.targets.length > 0) {
      return input.targets.map((t) => ({
        id: t.channelId,
        provider: t.provider,
        customContent: t.customContent,
        settings: t.settings,
      }));
    }
    if (input.channels && input.channels.length > 0) {
      return input.channels.map((c) => ({
        id: c.postizIntegrationId || c.channelId || c.id || "",
        provider: c.provider,
      }));
    }
    return input.channelIds || [];
  }

  async createDraft(
    input: PublishDraftInput,
    options?: EngineOptions,
  ): Promise<EnginePostResult> {
    const media = this.resolveMediaPayload(input);
    const integrations = this.resolveIntegrationTargets(input);
    const res = await this.client.createDraft(
      {
        content: input.content,
        integrations,
        ...(media ? { media } : {}),
        ...(input.settings || input.title
          ? {
              settings: {
                ...(input.settings ?? {}),
                ...(input.title ? { title: input.title } : {}),
              },
            }
          : {}),
      },
      options,
    );
    return this.normalizePostResult(res, "DRAFT");
  }

  async schedulePost(
    input: SchedulePostInput,
    options?: EngineOptions,
  ): Promise<EnginePostResult> {
    const media = this.resolveMediaPayload(input);
    const dateStr =
      input.scheduledAt instanceof Date
        ? input.scheduledAt.toISOString()
        : input.scheduledAt;
    const integrations = this.resolveIntegrationTargets(input);
    const res = await this.client.schedulePost(
      {
        content: input.content,
        date: dateStr,
        integrations,
        ...(media ? { media } : {}),
        ...(input.settings || input.title
          ? {
              settings: {
                ...(input.settings ?? {}),
                ...(input.title ? { title: input.title } : {}),
              },
            }
          : {}),
      },
      options,
    );
    return this.normalizePostResult(res, "SCHEDULED", dateStr);
  }

  async publishNow(
    input: PublishNowInput,
    options?: EngineOptions,
  ): Promise<EnginePostResult> {
    const media = this.resolveMediaPayload(input);
    const integrations = this.resolveIntegrationTargets(input);
    const res = await this.client.publishNow(
      {
        content: input.content,
        integrations,
        ...(media ? { media } : {}),
        ...(input.settings || input.title
          ? {
              settings: {
                ...(input.settings ?? {}),
                ...(input.title ? { title: input.title } : {}),
              },
            }
          : {}),
      },
      options,
    );
    return this.normalizePostResult(res, "PUBLISHING");
  }

  async cancelPost(
    enginePostId: string,
    options?: EngineOptions,
  ): Promise<boolean> {
    const res = await this.client.deletePost(enginePostId, options);
    return res.success;
  }

  async getPostStatus(
    enginePostId: string,
    approxDate?: Date,
    options?: EngineOptions,
  ): Promise<EnginePostStatusResult | null> {
    const base = approxDate ?? new Date();
    // Default search window: ±14 days around target date
    const startDate = new Date(base.getTime() - 14 * 86400000).toISOString();
    const endDate = new Date(base.getTime() + 14 * 86400000).toISOString();

    let posts = await this.client.listPosts(startDate, endDate, options);
    let found = posts.find(
      (p) => p.id === enginePostId || p.postId === enginePostId,
    );

    // Fall back to ±60 days if post is not found in narrow window
    if (!found) {
      const broadStart = new Date(base.getTime() - 60 * 86400000).toISOString();
      const broadEnd = new Date(base.getTime() + 60 * 86400000).toISOString();
      posts = await this.client.listPosts(broadStart, broadEnd, options);
      found = posts.find(
        (p) => p.id === enginePostId || p.postId === enginePostId,
      );
    }

    if (!found) {
      return null;
    }

    const rawState = (found.state || "").toUpperCase();
    const state: EnginePostStatusResult["state"] =
      rawState === "PUBLISHED"
        ? "PUBLISHED"
        : rawState === "ERROR"
          ? "ERROR"
          : rawState === "QUEUE"
            ? "QUEUE"
            : rawState === "DRAFT"
              ? "DRAFT"
              : "UNKNOWN";

    return {
      enginePostId,
      state,
      releaseUrl: (found as any).releaseURL ?? null,
      releaseId: found.releaseId ?? null,
      error: (found as any).error ?? null,
    };
  }

  async importMedia(
    mediaUrl: string,
    options?: EngineOptions,
  ): Promise<NormalizedMediaAsset> {
    const res = await this.client.uploadFromUrl(mediaUrl, options);
    return {
      id: res.id,
      url: res.path,
      ...(res.name ? { name: res.name } : {}),
      ...(res.mimeType ? { mimeType: res.mimeType } : {}),
    };
  }

  async getChannelAnalytics(
    integrationId: string,
    days = 30,
    options?: EngineOptions,
  ): Promise<NormalizedChannelAnalytics> {
    try {
      const raw = await this.client.getAnalytics(integrationId, days, options);
      if (!Array.isArray(raw) || raw.length === 0) {
        return {
          available: false,
          days,
          metrics: [],
          reason: "No analytics metrics returned by provider",
        };
      }

      const metrics: NormalizedAnalyticsMetric[] = raw.map((item: any) => {
        const timeseries: Array<{ date: string; total: number }> = (
          item.data || []
        ).map((d: any) => ({
          date: d.date,
          total: Number(d.total) || 0,
        }));

        const total = timeseries.reduce((acc, curr) => acc + curr.total, 0);

        // DO NOT echo Postiz's hardcoded fake 5% percentageChange.
        // Instead compute real percentage change if there are sufficient data points (>= 4),
        // or set to null if unavailable.
        let percentageChange: number | null = null;
        if (timeseries.length >= 4) {
          const mid = Math.floor(timeseries.length / 2);
          const firstHalf = timeseries
            .slice(0, mid)
            .reduce((s, d) => s + d.total, 0);
          const secondHalf = timeseries
            .slice(mid)
            .reduce((s, d) => s + d.total, 0);
          if (firstHalf > 0) {
            percentageChange = Math.round(
              ((secondHalf - firstHalf) / firstHalf) * 100,
            );
          } else if (secondHalf > 0) {
            percentageChange = 100;
          } else {
            percentageChange = 0;
          }
        }

        return {
          label: item.label || "Metric",
          total,
          percentageChange,
          data: timeseries,
        };
      });

      return {
        available: true,
        days,
        metrics,
      };
    } catch (err: any) {
      return {
        available: false,
        days,
        metrics: [],
        reason: err.message || "Failed to retrieve provider analytics",
      };
    }
  }

  private normalizePostResult(
    raw: PostizCreatePostResponse,
    defaultStatus: EnginePostResult["status"],
    scheduledFor?: string,
  ): EnginePostResult {
    if (Array.isArray(raw)) {
      const first = raw[0];
      const enginePostId = first?.postId ?? first?.id ?? "unknown";
      const channelResults = raw.map((item) => ({
        channelId:
          typeof item.integration === "string"
            ? item.integration
            : ((item.integration as any)?.id ?? "unknown"),
        enginePostId: item.postId ?? item.id ?? enginePostId,
      }));

      return {
        enginePostId,
        status: defaultStatus,
        ...(scheduledFor ? { scheduledFor } : {}),
        channelResults,
      };
    }

    const scheduled = raw.publishDate ?? scheduledFor;
    return {
      enginePostId: raw.postId ?? raw.id ?? "unknown",
      status: defaultStatus,
      ...(scheduled ? { scheduledFor: scheduled } : {}),
    };
  }
}

/**
 * Factory for PublishingEngine.
 */
export function getPublishingEngine(client?: PostizClient): PublishingEngine {
  return new PostizPublishingEngine(client);
}
