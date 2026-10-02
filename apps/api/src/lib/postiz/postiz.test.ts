import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PostizClient,
  PostizAuthenticationError,
  PostizNotFoundError,
  PostizValidationError,
  PostizRateLimitError,
  PostizServerError,
  PostizTimeoutError,
  PostizNetworkError,
  PostizError,
} from "./index.js";

describe("PostizClient (Adapter Boundary)", () => {
  const fakeBaseUrl = "http://localhost:4008";
  const fakeApiKey = "test_api_key_secret_12345";
  let client: PostizClient;

  beforeEach(() => {
    client = new PostizClient({
      baseUrl: fakeBaseUrl,
      apiKey: fakeApiKey,
      timeoutMs: 500,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isConnected()", () => {
    it("returns true when endpoint responds with 200 OK", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ valid: true }),
        }),
      );

      const result = await client.isConnected();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/is-connected",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: fakeApiKey,
            Accept: "application/json",
          }),
        }),
      );
    });

    it("returns false when endpoint responds with 401 Unauthorized", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ message: "Invalid API Key" }),
        }),
      );

      const result = await client.isConnected();
      expect(result).toBe(false);
    });

    it("returns false on network or connection errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      );

      const result = await client.isConnected();
      expect(result).toBe(false);
    });
  });

  describe("listIntegrations()", () => {
    it("returns parsed integrations list on success", async () => {
      const mockIntegrations = [
        {
          id: "int_linkedin_1",
          name: "Company LinkedIn",
          identifier: "linkedin-page",
          picture: "https://r2.example.com/pic.jpg",
          disabled: false,
        },
        {
          id: "int_x_1",
          name: "@mybrand",
          identifier: "x",
          disabled: false,
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockIntegrations,
        }),
      );

      const result = await client.listIntegrations();
      expect(result).toEqual(mockIntegrations);
    });

    it("successfully parses integrations with string profile and customer object", async () => {
      const realPostizPayload = [
        {
          id: "int_fb_1",
          name: "Acme Facebook Page",
          identifier: "facebook",
          picture: "https://graph.facebook.com/pic.jpg",
          disabled: false,
          profile: "10928374652",
          customer: {
            id: "cust_123",
            name: "Client Account",
          },
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => realPostizPayload,
        }),
      );

      const result = await client.listIntegrations();
      expect(result).toHaveLength(1);
      expect(result[0]!.profile).toBe("10928374652");
      expect(result[0]!.customer?.id).toBe("cust_123");
    });

    it("includes x-postiz-org header when organizationId is supplied", async () => {
      const customClient = new PostizClient({
        baseUrl: fakeBaseUrl,
        apiKey: fakeApiKey,
        organizationId: "org-uuid-999",
      });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => [],
        }),
      );

      await customClient.listIntegrations();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-postiz-org": "org-uuid-999",
          }),
        }),
      );
    });
  });

  describe("getConnectUrl()", () => {
    it("returns authorization URL and properly URL-encodes provider", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            url: "https://www.linkedin.com/oauth/v2/authorization?client_id=123",
          }),
        }),
      );

      const url = await client.getConnectUrl("linkedin-page");
      expect(url).toBe(
        "https://www.linkedin.com/oauth/v2/authorization?client_id=123",
      );
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/social/linkedin-page",
        expect.anything(),
      );
    });
  });

  describe("disconnectIntegration()", () => {
    it("sends DELETE request and returns success flag", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        }),
      );

      const res = await client.disconnectIntegration("int_abc_123");
      expect(res.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/integrations/int_abc_123",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("listPosts()", () => {
    it("encodes query parameters and returns post list", async () => {
      const mockPosts = [
        {
          id: "post_1",
          postId: "p1",
          state: "SCHEDULED",
          publishDate: "2026-10-01T10:00:00Z",
          content: "Scheduled post #1",
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockPosts,
        }),
      );

      const posts = await client.listPosts(
        "2026-10-01T00:00:00Z",
        "2026-10-02T00:00:00Z",
      );
      expect(posts).toEqual(mockPosts);
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/posts?startDate=2026-10-01T00%3A00%3A00Z&endDate=2026-10-02T00%3A00%3A00Z",
        expect.anything(),
      );
    });
  });

  describe("createDraft(), schedulePost(), publishNow()", () => {
    it("createDraft dispatches POST with type: 'draft'", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({
            id: "post_draft_1",
            state: "DRAFT",
            content: "Draft content",
          }),
        }),
      );

      const res = await client.createDraft({
        content: "Draft content",
        integrations: ["int_1"],
      });

      expect(res).toEqual({
        id: "post_draft_1",
        state: "DRAFT",
        content: "Draft content",
      });
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/posts",
        expect.objectContaining({
          method: "POST",
        }),
      );
      const call = (fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.type).toBe("draft");
      expect(body.content).toBe("Draft content");
      expect(body.posts).toEqual([
        {
          integration: { id: "int_1" },
          value: [{ content: "Draft content", image: [] }],
          settings: {},
        },
      ]);
    });

    it("schedulePost dispatches POST with type: 'schedule' and date", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({
            id: "post_sched_1",
            state: "QUEUE",
            publishDate: "2026-11-01T15:00:00Z",
          }),
        }),
      );

      const res = await client.schedulePost({
        content: "Holiday promo",
        date: "2026-11-01T15:00:00Z",
        integrations: ["int_1"],
      });

      expect(res).toEqual({
        id: "post_sched_1",
        state: "QUEUE",
        publishDate: "2026-11-01T15:00:00Z",
      });
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/posts",
        expect.objectContaining({
          method: "POST",
        }),
      );
      const call = (fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.type).toBe("schedule");
      expect(body.date).toBe("2026-11-01T15:00:00Z");
      expect(body.posts).toEqual([
        {
          integration: { id: "int_1" },
          value: [{ content: "Holiday promo", image: [] }],
          settings: {},
        },
      ]);
    });

    it("publishNow dispatches POST with type: 'now'", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({ id: "post_now_1", state: "PROCESSING" }),
        }),
      );

      const res = await client.publishNow({
        content: "Breaking announcement",
        integrations: ["int_1"],
      });

      expect(res).toEqual({ id: "post_now_1", state: "PROCESSING" });
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/posts",
        expect.objectContaining({
          method: "POST",
        }),
      );
      const call = (fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.type).toBe("now");
      expect(body.posts).toEqual([
        {
          integration: { id: "int_1" },
          value: [{ content: "Breaking announcement", image: [] }],
          settings: {},
        },
      ]);
    });

    it("attaches media objects into posts[].value[].image with id and path", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({ id: "post_media_1", state: "PROCESSING" }),
        }),
      );

      await client.publishNow({
        content: "Check this photo",
        integrations: ["int_fb_1"],
        media: [
          {
            id: "asset-123",
            path: "https://r2.example.com/asset-123.png?signed=true",
          },
        ],
      });

      const call = (fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.posts[0].value[0].image).toEqual([
        {
          id: "asset-123",
          path: "https://r2.example.com/asset-123.png?signed=true",
        },
      ]);
    });

    it("retains multiple media attachments and normalizes string URLs", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({ id: "post_media_multi", state: "PROCESSING" }),
        }),
      );

      await client.publishNow({
        content: "Multi photo post",
        integrations: ["int_fb_1"],
        media: [
          { id: "asset-1", path: "https://r2.example.com/pic1.jpg" },
          "https://r2.example.com/pic2.png",
        ],
      });

      const call = (fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.posts[0].value[0].image).toEqual([
        { id: "asset-1", path: "https://r2.example.com/pic1.jpg" },
        { id: "media-1", path: "https://r2.example.com/pic2.png" },
      ]);
    });

    it("injects settings.post_type = 'post' specifically for Instagram targets while leaving Facebook untouched", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({ id: "post_cross_provider", state: "PROCESSING" }),
        }),
      );

      await client.publishNow({
        content: "Cross-platform post",
        integrations: [
          { id: "ig_channel_1", provider: "instagram" },
          { id: "fb_channel_1", provider: "facebook" },
        ],
        media: [
          {
            id: "asset-ig",
            path: "https://r2.example.com/asset-ig.png",
          },
        ],
      });

      const call = (fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      // Instagram target must have post_type: "post"
      expect(body.posts[0].integration.id).toBe("ig_channel_1");
      expect(body.posts[0].settings).toEqual({ post_type: "post" });

      // Facebook target must not have post_type injected
      expect(body.posts[1].integration.id).toBe("fb_channel_1");
      expect(body.posts[1].settings).toEqual({});
    });

    it("preserves explicitly specified settings.post_type for Instagram", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({ id: "post_ig_story", state: "PROCESSING" }),
        }),
      );

      await client.publishNow({
        content: "Story post",
        integrations: [
          { id: "ig_channel_1", provider: "instagram", settings: { post_type: "story" } },
        ],
      });

      const call = (fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.posts[0].settings).toEqual({ post_type: "story" });
    });
  });

  describe("deletePost()", () => {
    it("sends DELETE to /public/v1/posts/:id", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        }),
      );

      const res = await client.deletePost("post_to_cancel");
      expect(res.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/posts/post_to_cancel",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("normalizes Postiz quirk returning { error: true } on HTTP 200 into { success: true }", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ error: true }),
        }),
      );

      const res = await client.deletePost("post_live_quirk");
      expect(res.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/posts/post_live_quirk",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("normalizes { deleted: true } into { success: true }", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ deleted: true }),
        }),
      );

      const res = await client.deletePost("post_deleted_flag");
      expect(res.success).toBe(true);
    });

    it("respects explicit { success: false } response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ success: false }),
        }),
      );

      const res = await client.deletePost("post_fail");
      expect(res.success).toBe(false);
    });
  });

  describe("uploadFromUrl()", () => {
    it("sends media ingest URL payload and parses response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({
            id: "media_pz_99",
            path: "https://r2.example.com/socialmesh-media/image.png",
          }),
        }),
      );

      const res = await client.uploadFromUrl(
        "https://r2.example.com/socialmesh-media/image.png",
      );
      expect(res.id).toBe("media_pz_99");
      expect(res.path).toBe(
        "https://r2.example.com/socialmesh-media/image.png",
      );
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4008/public/v1/upload-from-url",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            url: "https://r2.example.com/socialmesh-media/image.png",
          }),
        }),
      );
    });
  });

  describe("Error handling and normalization", () => {
    it("normalizes 401/403 into PostizAuthenticationError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ message: "Unauthorized API Key" }),
        }),
      );

      await expect(client.listIntegrations()).rejects.toThrow(
        PostizAuthenticationError,
      );
    });

    it("normalizes 404 into PostizNotFoundError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ message: "Post not found" }),
        }),
      );

      await expect(client.deletePost("nonexistent_id")).rejects.toThrow(
        PostizNotFoundError,
      );
    });

    it("normalizes 400/422 into PostizValidationError", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({ message: "Missing scheduled date" }),
        }),
      );

      await expect(client.createDraft({})).rejects.toThrow(
        PostizValidationError,
      );
    });

    it("normalizes 429 into PostizRateLimitError with parsed Retry-After header", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          headers: new Headers({ "Retry-After": "60" }),
          json: async () => ({ message: "Too many requests" }),
        }),
      );

      let caughtError: unknown;
      try {
        await client.listIntegrations();
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(PostizRateLimitError);
      expect((caughtError as PostizRateLimitError).retryAfterSeconds).toBe(60);
      expect((caughtError as PostizRateLimitError).isRetryable).toBe(true);
    });

    it("normalizes 500 into PostizServerError with isRetryable = true", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ message: "Internal Temporal error" }),
        }),
      );

      let caughtError: unknown;
      try {
        await client.listIntegrations();
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(PostizServerError);
      expect((caughtError as PostizServerError).isRetryable).toBe(true);
    });

    it("normalizes fetch network failures into PostizNetworkError", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockRejectedValue(
            new Error("getaddrinfo ENOTFOUND postiz.internal"),
          ),
      );

      await expect(client.listIntegrations()).rejects.toThrow(
        PostizNetworkError,
      );
    });

    it("fails with PostizValidationError when response fails Zod schema validation", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          // Missing required 'url' property for connect url
          json: async () => ({ invalidPayload: 123 }),
        }),
      );

      await expect(client.getConnectUrl("facebook")).rejects.toThrow(
        PostizValidationError,
      );
    });
  });

  describe("Timeouts, AbortSignal and Security", () => {
    it("times out and throws PostizTimeoutError when server exceeds timeoutMs", async () => {
      const slowClient = new PostizClient({
        baseUrl: fakeBaseUrl,
        apiKey: fakeApiKey,
        timeoutMs: 50,
      });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ valid: true }),
                });
              }, 200);
            }),
        ),
      );

      await expect(slowClient.listIntegrations()).rejects.toThrow(
        PostizTimeoutError,
      );
    });

    it("respects caller AbortSignal and throws abort error", async () => {
      const abortController = new AbortController();

      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url, init) => {
          return new Promise((_, reject) => {
            init.signal.addEventListener("abort", () => {
              const err = new Error("This operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          });
        }),
      );

      const promise = client.listIntegrations({
        signal: abortController.signal,
      });
      abortController.abort();

      await expect(promise).rejects.toThrow(PostizError);
    });

    it("never includes raw API key in thrown error messages", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ message: "Unauthorized token" }),
        }),
      );

      try {
        await client.listIntegrations();
      } catch (err: any) {
        expect(err.message).not.toContain(fakeApiKey);
        expect(JSON.stringify(err)).not.toContain(fakeApiKey);
      }
    });

    it("throws immediately if instantiated without API key and a call is attempted", async () => {
      const noKeyClient = new PostizClient({
        baseUrl: fakeBaseUrl,
        apiKey: "",
      });

      await expect(noKeyClient.listIntegrations()).rejects.toThrow(
        PostizAuthenticationError,
      );
    });

    it("throws PostizValidationError if baseUrl is empty", async () => {
      const noUrlClient = new PostizClient({
        baseUrl: "",
        apiKey: fakeApiKey,
      });

      await expect(noUrlClient.listIntegrations()).rejects.toThrow(
        PostizValidationError,
      );
    });

    it("isConnected() returns false safely when apiKey or baseUrl is missing without throwing", async () => {
      const unconfiguredClient = new PostizClient({
        baseUrl: "",
        apiKey: "",
      });

      const connected = await unconfiguredClient.isConnected();
      expect(connected).toBe(false);
    });
  });

  describe("Routing & Path Protection", () => {
    it("rejects paths with /api prefix to prevent accidental legacy routes", async () => {
      await expect(
        (client as any).request("/api/public/v1/is-connected", {}),
      ).rejects.toThrow(PostizValidationError);

      await expect(
        (client as any).request("/api/public/v1/posts", {}),
      ).rejects.toThrow(
        /Direct headless Postiz routes must not include \/api prefix/,
      );
    });

    it("defaults baseUrl from env.POSTIZ_BASE_URL if not explicitly configured", () => {
      const defaultClient = new PostizClient({ apiKey: "key123" });
      expect((defaultClient as any).baseUrl).toBe(
        process.env.POSTIZ_BASE_URL || "",
      );
    });

    it("normalizes and strips trailing slashes from baseUrl", () => {
      const slashClient = new PostizClient({
        baseUrl: "http://localhost:4008///",
        apiKey: "key123",
      });
      expect((slashClient as any).baseUrl).toBe("http://localhost:4008");
    });
  });
});
