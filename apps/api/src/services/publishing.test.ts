import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostizClient } from "../lib/postiz/index.js";
import { PostizPublishingEngine } from "./publishing.js";

describe("PostizPublishingEngine (Service Abstraction)", () => {
  let mockClient: PostizClient;
  let engine: PostizPublishingEngine;

  beforeEach(() => {
    mockClient = new PostizClient({
      baseUrl: "http://localhost:4008",
      apiKey: "test-key",
    });
    engine = new PostizPublishingEngine(mockClient);
  });

  it("isHealthy() proxies isConnected()", async () => {
    vi.spyOn(mockClient, "isConnected").mockResolvedValue(true);
    const healthy = await engine.isHealthy();
    expect(healthy).toBe(true);
    expect(mockClient.isConnected).toHaveBeenCalled();
  });

  it("listChannels() normalizes Postiz integrations into SociaMesh channels", async () => {
    vi.spyOn(mockClient, "listIntegrations").mockResolvedValue([
      {
        id: "int_fb_1",
        name: "Acme Facebook Page",
        identifier: "facebook",
        picture: "https://r2.example.com/fb.png",
        disabled: false,
      },
      {
        id: "int_li_1",
        name: "Acme LinkedIn",
        identifier: "linkedin-page",
        picture: null,
        disabled: true,
      },
    ]);

    const channels = await engine.listChannels();
    expect(channels).toEqual([
      {
        id: "int_fb_1",
        provider: "facebook",
        name: "Acme Facebook Page",
        pictureUrl: "https://r2.example.com/fb.png",
        isActive: true,
      },
      {
        id: "int_li_1",
        provider: "linkedin-page",
        name: "Acme LinkedIn",
        pictureUrl: null,
        isActive: false,
      },
    ]);
  });

  it("getChannelConnectUrl() returns authorization URL", async () => {
    vi.spyOn(mockClient, "getConnectUrl").mockResolvedValue(
      "https://oauth.provider.com/auth",
    );
    const url = await engine.getChannelConnectUrl("facebook");
    expect(url).toBe("https://oauth.provider.com/auth");
    expect(mockClient.getConnectUrl).toHaveBeenCalledWith(
      "facebook",
      undefined,
      undefined,
    );
  });

  it("completeOAuth() completes token exchange and normalizes channel", async () => {
    vi.spyOn(mockClient, "completeSocialConnection").mockResolvedValue({
      id: "pz_int_fb_1",
      name: "Acme Facebook Page",
      identifier: "facebook",
      picture: "https://example.com/fb.png",
      disabled: false,
    });
    const channel = await engine.completeOAuth("facebook", {
      code: "code123",
      state: "state123",
    });
    expect(channel).toEqual({
      id: "pz_int_fb_1",
      provider: "facebook",
      name: "Acme Facebook Page",
      pictureUrl: "https://example.com/fb.png",
      isActive: true,
    });
    expect(mockClient.completeSocialConnection).toHaveBeenCalledWith(
      "facebook",
      { code: "code123", state: "state123" },
      undefined,
    );
  });

  it("disconnectChannel() returns boolean success", async () => {
    vi.spyOn(mockClient, "disconnectIntegration").mockResolvedValue({
      success: true,
    });
    const ok = await engine.disconnectChannel("int_fb_1");
    expect(ok).toBe(true);
    expect(mockClient.disconnectIntegration).toHaveBeenCalledWith(
      "int_fb_1",
      undefined,
    );
  });

  it("createDraft() normalizes Postiz draft creation response", async () => {
    vi.spyOn(mockClient, "createDraft").mockResolvedValue([
      { postId: "pz_post_101", integration: "int_1" },
    ]);

    const result = await engine.createDraft({
      content: "Exciting draft!",
      channelIds: ["int_1"],
    });

    expect(result).toEqual({
      enginePostId: "pz_post_101",
      status: "DRAFT",
      scheduledFor: undefined,
      channelResults: [{ channelId: "int_1", enginePostId: "pz_post_101" }],
    });
  });

  it("schedulePost() normalizes scheduled post response", async () => {
    const scheduledDate = new Date("2026-10-15T14:00:00Z");
    vi.spyOn(mockClient, "schedulePost").mockResolvedValue([
      { postId: "pz_sched_202", integration: "int_1" },
    ]);

    const result = await engine.schedulePost({
      content: "Scheduled announcement",
      scheduledAt: scheduledDate,
      channelIds: ["int_1"],
    });

    expect(result).toEqual({
      enginePostId: "pz_sched_202",
      status: "SCHEDULED",
      scheduledFor: "2026-10-15T14:00:00.000Z",
      channelResults: [{ channelId: "int_1", enginePostId: "pz_sched_202" }],
    });
  });

  it("publishNow() normalizes immediate post response", async () => {
    vi.spyOn(mockClient, "publishNow").mockResolvedValue([
      { postId: "pz_now_303", integration: "int_1" },
    ]);

    const result = await engine.publishNow({
      content: "Breaking news!",
      channelIds: ["int_1"],
      media: [{ id: "asset-1", url: "https://r2.example.com/asset-1.png" }],
    });

    expect(result).toEqual({
      enginePostId: "pz_now_303",
      status: "PUBLISHING",
      scheduledFor: undefined,
      channelResults: [{ channelId: "int_1", enginePostId: "pz_now_303" }],
    });
    expect(mockClient.publishNow).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Breaking news!",
        integrations: ["int_1"],
        media: [{ id: "asset-1", path: "https://r2.example.com/asset-1.png" }],
      }),
      undefined,
    );
  });

  it("cancelPost() returns success flag", async () => {
    vi.spyOn(mockClient, "deletePost").mockResolvedValue({ success: true });
    const ok = await engine.cancelPost("pz_post_101");
    expect(ok).toBe(true);
    expect(mockClient.deletePost).toHaveBeenCalledWith(
      "pz_post_101",
      undefined,
    );
  });

  it("importMedia() normalizes media asset response", async () => {
    vi.spyOn(mockClient, "uploadFromUrl").mockResolvedValue({
      id: "pz_med_1",
      path: "https://r2.example.com/asset.png",
      name: "asset.png",
      mimeType: "image/png",
    });

    const media = await engine.importMedia("https://r2.example.com/asset.png");
    expect(media).toEqual({
      id: "pz_med_1",
      url: "https://r2.example.com/asset.png",
      name: "asset.png",
      mimeType: "image/png",
    });
  });

  it("getPostStatus() finds post and normalizes state and releaseUrl", async () => {
    vi.spyOn(mockClient, "listPosts").mockResolvedValue([
      {
        id: "pz_post_published",
        state: "PUBLISHED",
        releaseURL: "https://facebook.com/123/posts/456",
        releaseId: "fb_456",
      },
    ]);

    const status = await engine.getPostStatus("pz_post_published");
    expect(status).toEqual({
      enginePostId: "pz_post_published",
      state: "PUBLISHED",
      releaseUrl: "https://facebook.com/123/posts/456",
      releaseId: "fb_456",
      error: null,
    });
  });

  it("getPostStatus() normalizes ERROR state and error message", async () => {
    vi.spyOn(mockClient, "listPosts").mockResolvedValue([
      {
        id: "pz_post_failed",
        state: "ERROR",
        error: "Photos should be less than 10 MB",
      } as any,
    ]);

    const status = await engine.getPostStatus("pz_post_failed");
    expect(status).toEqual({
      enginePostId: "pz_post_failed",
      state: "ERROR",
      releaseUrl: null,
      releaseId: null,
      error: "Photos should be less than 10 MB",
    });
  });

  it("getChannelAnalytics() normalizes metrics and strips fake hardcoded percentageChange", async () => {
    vi.spyOn(mockClient, "getAnalytics").mockResolvedValue([
      {
        label: "Impressions",
        percentageChange: 5, // Fake value from Postiz
        data: [
          { date: "2026-09-01", total: 100 },
          { date: "2026-09-02", total: 100 },
          { date: "2026-09-03", total: 150 },
          { date: "2026-09-04", total: 150 },
        ],
      },
    ]);

    const analytics = await engine.getChannelAnalytics("int_fb_1", 30);
    expect(analytics.available).toBe(true);
    expect(analytics.days).toBe(30);
    expect(analytics.metrics).toHaveLength(1);
    expect(analytics.metrics[0]!.total).toBe(500);
    // Calculated real change: first half (200) -> second half (300) = +50%
    expect(analytics.metrics[0]!.percentageChange).toBe(50);
  });

  it("getChannelAnalytics() handles client error gracefully", async () => {
    vi.spyOn(mockClient, "getAnalytics").mockRejectedValue(
      new Error("Postiz analytics endpoint 404"),
    );

    const analytics = await engine.getChannelAnalytics("int_invalid", 30);
    expect(analytics.available).toBe(false);
    expect(analytics.metrics).toEqual([]);
    expect(analytics.reason).toMatch(/404/);
  });
});
