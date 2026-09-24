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
    });

    expect(result).toEqual({
      enginePostId: "pz_now_303",
      status: "PUBLISHING",
      scheduledFor: undefined,
      channelResults: [{ channelId: "int_1", enginePostId: "pz_now_303" }],
    });
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
});
