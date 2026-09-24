import {
  PostizClient,
  getPostizClient,
  type PostizIntegration,
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

/**
 * Input for creating a draft in the publishing engine.
 */
export interface PublishDraftInput {
  content: string;
  channelIds: string[];
  mediaUrls?: string[] | undefined;
  title?: string | undefined;
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
  channelResults?: {
    channelId: string;
    enginePostId: string;
  }[] | undefined;
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
export interface PublishingEngine {
  isHealthy(options?: EngineOptions): Promise<boolean>;
  listChannels(options?: EngineOptions): Promise<NormalizedChannel[]>;
  getChannelConnectUrl(provider: string, options?: EngineOptions): Promise<string>;
  disconnectChannel(channelId: string, options?: EngineOptions): Promise<boolean>;
  createDraft(input: PublishDraftInput, options?: EngineOptions): Promise<EnginePostResult>;
  schedulePost(input: SchedulePostInput, options?: EngineOptions): Promise<EnginePostResult>;
  publishNow(input: PublishNowInput, options?: EngineOptions): Promise<EnginePostResult>;
  cancelPost(enginePostId: string, options?: EngineOptions): Promise<boolean>;
  importMedia(mediaUrl: string, options?: EngineOptions): Promise<NormalizedMediaAsset>;
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

  async getChannelConnectUrl(provider: string, options?: EngineOptions): Promise<string> {
    return this.client.getConnectUrl(provider, options);
  }

  async disconnectChannel(channelId: string, options?: EngineOptions): Promise<boolean> {
    const res = await this.client.disconnectIntegration(channelId, options);
    return res.success;
  }

  async createDraft(input: PublishDraftInput, options?: EngineOptions): Promise<EnginePostResult> {
    const res = await this.client.createDraft(
      {
        content: input.content,
        integrations: input.channelIds,
        ...(input.mediaUrls ? { media: input.mediaUrls } : {}),
        ...(input.title ? { settings: { title: input.title } } : {}),
      },
      options,
    );
    return this.normalizePostResult(res, "DRAFT");
  }

  async schedulePost(input: SchedulePostInput, options?: EngineOptions): Promise<EnginePostResult> {
    const dateStr = input.scheduledAt instanceof Date ? input.scheduledAt.toISOString() : input.scheduledAt;
    const res = await this.client.schedulePost(
      {
        content: input.content,
        date: dateStr,
        integrations: input.channelIds,
        ...(input.mediaUrls ? { media: input.mediaUrls } : {}),
        ...(input.title ? { settings: { title: input.title } } : {}),
      },
      options,
    );
    return this.normalizePostResult(res, "SCHEDULED", dateStr);
  }

  async publishNow(input: PublishNowInput, options?: EngineOptions): Promise<EnginePostResult> {
    const res = await this.client.publishNow(
      {
        content: input.content,
        integrations: input.channelIds,
        ...(input.mediaUrls ? { media: input.mediaUrls } : {}),
        ...(input.title ? { settings: { title: input.title } } : {}),
      },
      options,
    );
    return this.normalizePostResult(res, "PUBLISHING");
  }

  async cancelPost(enginePostId: string, options?: EngineOptions): Promise<boolean> {
    const res = await this.client.deletePost(enginePostId, options);
    return res.success;
  }

  async importMedia(mediaUrl: string, options?: EngineOptions): Promise<NormalizedMediaAsset> {
    const res = await this.client.uploadFromUrl(mediaUrl, options);
    return {
      id: res.id,
      url: res.path,
      ...(res.name ? { name: res.name } : {}),
      ...(res.mimeType ? { mimeType: res.mimeType } : {}),
    };
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
        channelId: typeof item.integration === "string" ? item.integration : (item.integration as any)?.id ?? "unknown",
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
