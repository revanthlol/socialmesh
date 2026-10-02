import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import {
  aggregatePostStatus,
  postsService,
} from "./modules/posts/posts.service.js";
import { channelsService } from "./modules/channels/channels.service.js";
import type {
  PublishingEngine,
  EnginePostResult,
} from "./services/publishing.js";

describe(
  "SociaMesh Channels, Workspace Isolation & Publishing Tests",
  { timeout: 25000 },
  () => {
    let server: Server;
    let baseUrl: string;

    const userAEmail = `user-a-${Date.now()}@example.com`;
    const userBEmail = `user-b-${Date.now()}@example.com`;
    const password = "SuperPassword123!";

    let cookieA = "";
    let cookieB = "";
    let workspaceAId = "";
    let workspaceBId = "";
    let channelAId = "";
    let channelBId = "";
    let stateTokenA = "";

    const mockPublishingEngine: PublishingEngine = {
      isHealthy: vi.fn().mockResolvedValue(true),
      listChannels: vi.fn().mockResolvedValue([
        {
          id: "postiz_int_alpha",
          provider: "linkedin-page",
          name: "Acme Corp LinkedIn",
          pictureUrl: "https://example.com/avatar.png",
          isActive: true,
        },
        {
          id: "postiz_int_beta",
          provider: "x",
          name: "Acme Tech X",
          pictureUrl: null,
          isActive: true,
        },
      ]),
      getChannelConnectUrl: vi
        .fn()
        .mockImplementation(async () => {
          return `https://auth.example.com/oauth/authorize?state=mock_state_${crypto.randomUUID()}`;
        }),
      completeOAuth: vi.fn().mockImplementation(async (provider: string) => ({
        id: "postiz_int_oauth_result",
        provider,
        name: `${provider} Connected Channel`,
        pictureUrl: "https://example.com/avatar.png",
        isActive: true,
      })),
      disconnectChannel: vi.fn().mockResolvedValue(true),
      createDraft: vi.fn().mockResolvedValue({
        enginePostId: "mock_draft_postiz_1",
        status: "DRAFT",
      }),
      schedulePost: vi.fn().mockImplementation((input: any) => {
        const channelResults = (input.channelIds || []).map(
          (cid: string, idx: number) => ({
            channelId: cid,
            enginePostId: `mock_sched_${cid}_${idx + 1}`,
          }),
        );
        return Promise.resolve({
          enginePostId:
            channelResults[0]?.enginePostId || "mock_sched_postiz_1",
          status: "SCHEDULED",
          scheduledFor: input.scheduledAt,
          channelResults,
        });
      }),
      publishNow: vi.fn().mockImplementation((input: any) => {
        const channelResults = (input.channelIds || []).map(
          (cid: string, idx: number) => ({
            channelId: cid,
            enginePostId: `mock_pub_${cid}_${idx + 1}`,
          }),
        );
        return Promise.resolve({
          enginePostId: channelResults[0]?.enginePostId || "mock_pub_postiz_1",
          status: "PUBLISHING",
          channelResults,
        });
      }),
      cancelPost: vi.fn().mockResolvedValue(true),
      getPostStatus: vi.fn().mockImplementation(async (enginePostId: string) => ({
        enginePostId,
        state: "QUEUE",
      })),
      importMedia: vi.fn().mockResolvedValue({
        id: "mock_media_1",
        url: "https://cdn.example.com/imported.png",
      }),
      getChannelAnalytics: vi.fn().mockResolvedValue({
        available: true,
        days: 30,
        metrics: [],
      }),
    };

    beforeAll(async () => {
      await prisma.workspaceChannel.deleteMany({
        where: {
          postizIntegrationId: {
            in: [
              "postiz_int_alpha",
              "postiz_int_beta",
              "postiz_int_oauth_result",
              "postiz_int_fb_multi",
              "postiz_int_1",
            ],
          },
        },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { email: { in: [userAEmail, userBEmail] } },
      }).catch(() => {});
      await prisma.pendingChannelConnection.deleteMany().catch(() => {});

      // Inject mock publishing engine into services
      (postsService as any).publishingEngine = mockPublishingEngine;
      (channelsService as any).publishingEngine = mockPublishingEngine;

      const app = createApp();
      await new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => {
          const addr = server.address() as any;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });

      // 1. Register User A (Workspace A)
      const resA = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userAEmail,
          password,
          displayName: "User Alpha",
          workspaceName: "Workspace Alpha",
        }),
      });
      const bodyA = await resA.json();
      cookieA = resA.headers.get("set-cookie")!.split(";")[0]!;
      workspaceAId = bodyA.data.workspace.id;

      // 2. Register User B (Workspace B)
      const resB = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userBEmail,
          password,
          displayName: "User Beta",
          workspaceName: "Workspace Beta",
        }),
      });
      const bodyB = await resB.json();
      cookieB = resB.headers.get("set-cookie")!.split(";")[0]!;
      workspaceBId = bodyB.data.workspace.id;
    });

    afterAll(async () => {
      try {
        await prisma.workspaceChannel.deleteMany({
          where: {
            postizIntegrationId: {
              in: [
                "postiz_int_alpha",
                "postiz_int_beta",
                "postiz_int_oauth_result",
                "postiz_int_fb_multi",
                "postiz_int_1",
              ],
            },
          },
        });
        await prisma.user.deleteMany({
          where: { email: { in: [userAEmail, userBEmail] } },
        });
      } catch {}

      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }, 20000);

    it("1. Workspace Isolation: User B cannot access Workspace A channels", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels`,
        {
          headers: { Cookie: cookieB },
        },
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("2. Channel Assignment: Workspace A owner lists available channels from shared org", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels/available`,
        {
          headers: { Cookie: cookieA },
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.channels.length).toBe(2);
      expect(body.data.channels[0].id).toBe("postiz_int_alpha");
      expect(body.data.channels[0].isAssignedToCurrent).toBe(false);
    });

    it("3. Channel Assignment: Workspace A owner assigns a channel to Workspace A", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            postizIntegrationId: "postiz_int_alpha",
            provider: "linkedin-page",
            name: "Acme Corp LinkedIn",
            pictureUrl: "https://example.com/avatar.png",
          }),
        },
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.workspaceId).toBe(workspaceAId);
      expect(body.data.postizIntegrationId).toBe("postiz_int_alpha");
      expect(body.data.name).toBe("Acme Corp LinkedIn");

      channelAId = body.data.id;
    });

    it("4. Channel Listing: Workspace A lists only its assigned channel", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels`,
        {
          headers: { Cookie: cookieA },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].id).toBe(channelAId);
      expect(body.data[0].postizIntegrationId).toBe("postiz_int_alpha");
    });

    it("5. Workspace Isolation: Workspace B cannot see Workspace A's assigned channel", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceBId}/channels`,
        {
          headers: { Cookie: cookieB },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBe(0); // Workspace B has no channels assigned
    });

    it("6. Connect URL & OAuth Context: Workspace A owner requests OAuth connect URL", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels/connect-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({ provider: "linkedin-page" }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.url).toContain("https://auth.example.com");
      expect(body.data.stateToken).toBeTruthy();
      stateTokenA = body.data.stateToken;

      const pending = await prisma.pendingChannelConnection.findUnique({
        where: { stateToken: stateTokenA },
      });
      expect(pending).toBeTruthy();
      expect(pending?.workspaceId).toBe(workspaceAId);
    });

    it("6a. OAuth Context: User B cannot claim User A's pending OAuth connection", async () => {
      const res = await fetch(`${baseUrl}/api/v1/channels/oauth/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieB,
        },
        body: JSON.stringify({ stateToken: stateTokenA }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.message).toMatch(
        /Cross-user or cross-workspace claim denied/i,
      );
    });

    it("6b. OAuth Context: User A resolves pending connection to Workspace A (single-use)", async () => {
      const res = await fetch(`${baseUrl}/api/v1/channels/oauth/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieA,
        },
        body: JSON.stringify({ stateToken: stateTokenA }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.workspaceId).toBe(workspaceAId);
      expect(body.data.provider).toBe("linkedin-page");

      // Verify single-use consumption: record should be deleted
      const pendingAfter = await prisma.pendingChannelConnection.findUnique({
        where: { stateToken: stateTokenA },
      });
      expect(pendingAfter).toBeNull();

      // Trying to resolve again should fail
      const replayRes = await fetch(
        `${baseUrl}/api/v1/channels/oauth/resolve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({ stateToken: stateTokenA }),
        },
      );
      expect(replayRes.status).toBe(400);
    });

    it("6c. OAuth Context: Expired pending token is rejected", async () => {
      const expiredToken = "expired-token-12345";
      const userA = await prisma.user.findUnique({
        where: { email: userAEmail },
      });
      await prisma.pendingChannelConnection.create({
        data: {
          workspaceId: workspaceAId,
          userId: userA!.id,
          provider: "linkedin-page",
          stateToken: expiredToken,
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        },
      });

      const res = await fetch(`${baseUrl}/api/v1/channels/oauth/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieA,
        },
        body: JSON.stringify({ stateToken: expiredToken }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toMatch(/expired/i);
    });

    it("6d. OAuth Context: User A completes direct OAuth callback with authorization code and Postiz state", async () => {
      // 1. Initiate OAuth connection for facebook
      const connectRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels/connect-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({ provider: "facebook" }),
        },
      );
      expect(connectRes.status).toBe(200);
      const connectBody = await connectRes.json();
      expect(connectBody.data.url).toContain("https://auth.example.com");

      // Verify postizState was recorded from url
      const pendingRecord = await prisma.pendingChannelConnection.findFirst({
        where: { workspaceId: workspaceAId, provider: "facebook" },
      });
      expect(pendingRecord).toBeTruthy();
      expect(pendingRecord?.postizState).toBeTruthy();
      const stateToResolveD = pendingRecord!.postizState!;

      // 2. Resolve using Postiz state and provider authorization code
      const resolveRes = await fetch(
        `${baseUrl}/api/v1/channels/oauth/resolve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            state: stateToResolveD,
            code: "mock_auth_code_987",
            provider: "facebook",
          }),
        },
      );

      expect(resolveRes.status).toBe(200);
      const resolveBody = await resolveRes.json();
      expect(resolveBody.data.success).toBe(true);
      expect(resolveBody.data.workspaceId).toBe(workspaceAId);
      expect(resolveBody.data.provider).toBe("facebook");
      expect(resolveBody.data.channel.postizIntegrationId).toBe(
        "postiz_int_oauth_result",
      );

      // Verify completeOAuth was called on engine
      expect(mockPublishingEngine.completeOAuth).toHaveBeenCalledWith(
        "facebook",
        {
          code: "mock_auth_code_987",
          state: stateToResolveD,
        },
      );

      // Verify single-use consumption: record deleted
      const pendingAfter = await prisma.pendingChannelConnection.findFirst({
        where: { id: pendingRecord!.id },
      });
      expect(pendingAfter).toBeNull();
    });

    it("6e. OAuth Context: Concurrent duplicate resolution requests resolve safely without duplicate engine completion or failure", async () => {
      // 1. Initiate OAuth connection
      const connectRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels/connect-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({ provider: "x" }),
        },
      );
      const connectBody = await connectRes.json();
      const stateTokenFromRes = connectBody.data.stateToken;
      const pendingRecord = await prisma.pendingChannelConnection.findUnique({
        where: { stateToken: stateTokenFromRes },
      });
      expect(pendingRecord).toBeTruthy();
      expect(pendingRecord?.postizState).toBeTruthy();
      const stateToResolveE = pendingRecord!.postizState!;

      // Track engine completion calls
      let completeOAuthCalls = 0;
      const originalComplete = mockPublishingEngine.completeOAuth;
      mockPublishingEngine.completeOAuth = vi
        .fn()
        .mockImplementation(async (provider: string) => {
          completeOAuthCalls++;
          await new Promise((r) => setTimeout(r, 150));
          return {
            id: "postiz_int_concurrent_result",
            provider,
            name: `${provider} Concurrent Account`,
            pictureUrl: null,
            isActive: true,
          };
        });

      try {
        // 2. Fire TWO concurrent resolution requests for the exact same state & code
        const [res1, res2] = await Promise.all([
          fetch(`${baseUrl}/api/v1/channels/oauth/resolve`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: cookieA,
            },
            body: JSON.stringify({
              state: stateToResolveE,
              code: "code_concurrent_123",
              provider: "x",
            }),
          }),
          fetch(`${baseUrl}/api/v1/channels/oauth/resolve`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: cookieA,
            },
            body: JSON.stringify({
              state: stateToResolveE,
              code: "code_concurrent_123",
              provider: "x",
            }),
          }),
        ]);

        // Both concurrent calls must succeed with 200
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);

        const body1 = await res1.json();
        const body2 = await res2.json();
        expect(body1.data.success).toBe(true);
        expect(body2.data.success).toBe(true);
        expect(body1.data.channel.id).toBe(body2.data.channel.id);

        // Engine completion must only be called ONCE (single-flight deduplicated)
        expect(completeOAuthCalls).toBe(1);

        // Workspace must have only one channel assignment for this integration
        const channels = await prisma.workspaceChannel.findMany({
          where: {
            workspaceId: workspaceAId,
            postizIntegrationId: "postiz_int_concurrent_result",
          },
        });
        expect(channels.length).toBe(1);
      } finally {
        mockPublishingEngine.completeOAuth = originalComplete;
      }
    });

    it("7. Posts Targeting: Workspace A creates draft targeting assigned channel", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Draft targeting LinkedIn #socialmesh",
            channelIds: [channelAId],
          }),
        },
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.status).toBe("DRAFT");
      expect(body.data.targets.length).toBe(1);
      expect(body.data.targets[0].channelId).toBe(channelAId);
      expect(body.data.targets[0].channel.name).toBe("Acme Corp LinkedIn");
    });

    it("8. Posts Targeting: Workspace B cannot target Workspace A's channel", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceBId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieB,
          },
          body: JSON.stringify({
            content: "Trying to hijack channel A",
            channelIds: [channelAId], // Channel belongs to Workspace A!
          }),
        },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toMatch(/do not belong to this workspace/i);
    });

    it("9. Publishing Engine: Publish Now transitions post & targets to PROCESSING with per-target postizPostId", async () => {
      // Create draft
      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Publish immediately to LinkedIn",
            channelIds: [channelAId],
          }),
        },
      );
      const draft = await createRes.json();
      const postId = draft.data.id;

      // Publish
      const pubRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${postId}/publish`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );

      expect(pubRes.status).toBe(200);
      const pubBody = await pubRes.json();
      expect(pubBody.data.status).toBe("PROCESSING");
      expect(pubBody.data.targets[0].status).toBe("PROCESSING");
      expect(pubBody.data.targets[0].postizPostId).toBe(
        "mock_pub_postiz_int_alpha_1",
      );
      expect(pubBody.data.publishedAt).toBeNull();
      expect(mockPublishingEngine.publishNow).toHaveBeenCalled();

      // Test Status Reconciliation Endpoint (QUEUE state preserves PROCESSING)
      const reconcileRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${postId}/reconcile`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );
      expect(reconcileRes.status).toBe(200);
      const recBody = await reconcileRes.json();
      expect(recBody.data.id).toBe(postId);
      expect(recBody.data.status).toBe("PROCESSING");

      // Once engine reports PUBLISHED, post & target reconcile to PUBLISHED with providerPostUrl
      mockPublishingEngine.getPostStatus = vi.fn().mockResolvedValue({
        enginePostId: "mock_pub_postiz_int_alpha_1",
        state: "PUBLISHED",
        releaseUrl: "https://facebook.com/12345/posts/67890",
        releaseId: "fb_67890",
      });

      const publishedReconcileRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${postId}/reconcile`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );
      expect(publishedReconcileRes.status).toBe(200);
      const pubRecBody = await publishedReconcileRes.json();
      expect(pubRecBody.data.status).toBe("PUBLISHED");
      expect(pubRecBody.data.targets[0].status).toBe("PUBLISHED");
      expect(pubRecBody.data.targets[0].providerPostUrl).toBe(
        "https://facebook.com/12345/posts/67890",
      );
    });

    it("9b. Media Publishing: Post with attached media transfers reachable R2 presigned URLs into engine payload", async () => {
      // Create a ready media asset in workspace A
      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          workspaceId: workspaceAId,
          kind: "IMAGE",
          objectKey: `workspaces/${workspaceAId}/media/test-photo.png`,
          originalName: "test-photo.png",
          mimeType: "image/png",
          byteSize: BigInt(12345),
          status: "READY",
        },
      });

      // Create draft targeting channel A with attached media
      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Post with attached photo",
            channelIds: [channelAId],
            mediaAssetIds: [mediaAsset.id],
          }),
        },
      );
      expect(createRes.status).toBe(201);
      const draft = await createRes.json();
      const postId = draft.data.id;
      expect(draft.data.media).toHaveLength(1);

      // Publish Now
      const pubRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${postId}/publish`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );

      expect(pubRes.status).toBe(200);
      const pubBody = await pubRes.json();
      expect(pubBody.data.status).toBe("PROCESSING");

      // Verify publishingEngine was called with structured media containing id and url
      expect(mockPublishingEngine.publishNow).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Post with attached photo",
          channelIds: ["postiz_int_alpha"],
          media: expect.arrayContaining([
            expect.objectContaining({
              id: mediaAsset.id,
              url: expect.stringMatching(/test-photo\.png/),
            }),
          ]),
        }),
      );
    });

    it("9c. Multi-Photo Publishing: preserves position ordering for multi-image Facebook album posts", async () => {
      const img1 = await prisma.mediaAsset.create({
        data: {
          workspaceId: workspaceAId,
          kind: "IMAGE",
          objectKey: `workspaces/${workspaceAId}/media/photo-1.png`,
          originalName: "photo-1.png",
          mimeType: "image/png",
          byteSize: BigInt(1000),
          status: "READY",
        },
      });

      const img2 = await prisma.mediaAsset.create({
        data: {
          workspaceId: workspaceAId,
          kind: "IMAGE",
          objectKey: `workspaces/${workspaceAId}/media/photo-2.png`,
          originalName: "photo-2.png",
          mimeType: "image/png",
          byteSize: BigInt(2000),
          status: "READY",
        },
      });

      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Multi-photo album post",
            channelIds: [channelAId],
            mediaAssetIds: [img1.id, img2.id],
          }),
        },
      );
      expect(createRes.status).toBe(201);
      const postData = (await createRes.json()).data;

      const pubRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${postData.id}/publish`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );
      expect(pubRes.status).toBe(200);

      // Verify that media payload is ordered position 0, then position 1
      expect(mockPublishingEngine.publishNow).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Multi-photo album post",
          channelIds: ["postiz_int_alpha"],
          media: [
            expect.objectContaining({ id: img1.id }),
            expect.objectContaining({ id: img2.id }),
          ],
        }),
      );
    });

    it("9d. Mixed Media Rejection: rejects mixing images and videos with 400 validation error", async () => {
      const img = await prisma.mediaAsset.create({
        data: {
          workspaceId: workspaceAId,
          kind: "IMAGE",
          objectKey: `workspaces/${workspaceAId}/media/sample-photo.png`,
          originalName: "sample-photo.png",
          mimeType: "image/png",
          byteSize: BigInt(1000),
          status: "READY",
        },
      });

      const video = await prisma.mediaAsset.create({
        data: {
          workspaceId: workspaceAId,
          kind: "VIDEO",
          objectKey: `workspaces/${workspaceAId}/media/sample-clip.mp4`,
          originalName: "sample-clip.mp4",
          mimeType: "video/mp4",
          byteSize: BigInt(5000),
          status: "READY",
        },
      });

      // Attempt creating draft with both an image and a video
      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Mixed media post",
            channelIds: [channelAId],
            mediaAssetIds: [img.id, video.id],
          }),
        },
      );
      expect(createRes.status).toBe(400);
      const body = await createRes.json();
      expect(body.error?.message || body.message).toMatch(/mixing images and videos/i);
    });

    it("9e. Multiple Video Rejection: rejects attaching multiple videos with 400 validation error", async () => {
      const vid1 = await prisma.mediaAsset.create({
        data: {
          workspaceId: workspaceAId,
          kind: "VIDEO",
          objectKey: `workspaces/${workspaceAId}/media/clip-1.mp4`,
          originalName: "clip-1.mp4",
          mimeType: "video/mp4",
          byteSize: BigInt(5000),
          status: "READY",
        },
      });

      const vid2 = await prisma.mediaAsset.create({
        data: {
          workspaceId: workspaceAId,
          kind: "VIDEO",
          objectKey: `workspaces/${workspaceAId}/media/clip-2.mp4`,
          originalName: "clip-2.mp4",
          mimeType: "video/mp4",
          byteSize: BigInt(6000),
          status: "READY",
        },
      });

      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Two videos post",
            channelIds: [channelAId],
            mediaAssetIds: [vid1.id, vid2.id],
          }),
        },
      );
      expect(createRes.status).toBe(400);
      const body = await createRes.json();
      expect(body.error?.message || body.message).toMatch(/multiple videos/i);
    });

    it("9f. Failure Status Reconciliation: transitions to FAILED when remote engine reports ERROR", async () => {
      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Post that will fail on remote provider",
            channelIds: [channelAId],
          }),
        },
      );
      const draft = await createRes.json();
      const failPostId = draft.data.id;

      await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${failPostId}/publish`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );

      // Mock remote engine returning ERROR
      mockPublishingEngine.getPostStatus = vi.fn().mockResolvedValue({
        enginePostId: "mock_pub_postiz_int_alpha_1",
        state: "ERROR",
        error: "Facebook API rejected: invalid dimensions",
      });

      const reconcileRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${failPostId}/reconcile`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );
      expect(reconcileRes.status).toBe(200);
      const recBody = await reconcileRes.json();
      expect(recBody.data.status).toBe("FAILED");
      expect(recBody.data.targets[0].status).toBe("FAILED");
      expect(recBody.data.targets[0].lastError).toBe(
        "Facebook API rejected: invalid dimensions",
      );
    });

    it("10. Scheduling: Schedule Post hands off to engine and marks targets & post SCHEDULED", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day

      // Create draft
      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Scheduled post for tomorrow",
            channelIds: [channelAId],
            scheduledFor: futureDate,
          }),
        },
      );
      const draft = await createRes.json();
      const postId = draft.data.id;

      // Schedule
      const schedRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${postId}/schedule`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );

      expect(schedRes.status).toBe(200);
      const schedBody = await schedRes.json();
      expect(schedBody.data.status).toBe("SCHEDULED");
      expect(schedBody.data.targets[0].status).toBe("SCHEDULED");
      expect(schedBody.data.targets[0].postizPostId).toBe(
        "mock_sched_postiz_int_alpha_1",
      );
      expect(mockPublishingEngine.schedulePost).toHaveBeenCalled();

      // Cancellation: Cancel scheduled post
      const cancelRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${postId}/cancel`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );

      expect(cancelRes.status).toBe(200);
      const cancelBody = await cancelRes.json();
      expect(cancelBody.data.status).toBe("CANCELLED");
      expect(cancelBody.data.targets[0].status).toBe("CANCELLED");
      expect(mockPublishingEngine.cancelPost).toHaveBeenCalledWith(
        "mock_sched_postiz_int_alpha_1",
      );
    });

    it("11. Multi-Channel Targeting & Cancellation: assigns distinct postizPostId per target and cancels all engine targets", async () => {
      // 1. Assign second channel (postiz_int_beta) to Workspace A
      const assignRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            postizIntegrationId: "postiz_int_beta",
            provider: "x",
            name: "Acme Tech X",
            pictureUrl: null,
          }),
        },
      );
      expect(assignRes.status).toBe(201);
      const assignBody = await assignRes.json();
      channelBId = assignBody.data.id;

      // 2. Create draft targeting BOTH channels
      const createRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
          },
          body: JSON.stringify({
            content: "Multi-channel announcement to LinkedIn and X",
            channelIds: [channelAId, channelBId],
          }),
        },
      );
      expect(createRes.status).toBe(201);
      const draft = await createRes.json();
      const multiPostId = draft.data.id;
      expect(draft.data.targets.length).toBe(2);

      // 3. Publish Now
      const pubRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${multiPostId}/publish`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );
      expect(pubRes.status).toBe(200);
      const pubBody = await pubRes.json();
      expect(pubBody.data.status).toBe("PROCESSING");
      expect(pubBody.data.targets.length).toBe(2);

      const targetAlpha = pubBody.data.targets.find(
        (t: any) => t.channelId === channelAId,
      );
      const targetBeta = pubBody.data.targets.find(
        (t: any) => t.channelId === channelBId,
      );

      expect(targetAlpha.postizPostId).toMatch(/^mock_pub_postiz_int_alpha_\d+$/);
      expect(targetBeta.postizPostId).toMatch(/^mock_pub_postiz_int_beta_\d+$/);
      expect(targetAlpha.postizPostId).not.toBe(targetBeta.postizPostId);

      // 4. Cancel multi-target post
      const cancelRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts/${multiPostId}/cancel`,
        {
          method: "POST",
          headers: { Cookie: cookieA },
        },
      );
      expect(cancelRes.status).toBe(200);
      const cancelBody = await cancelRes.json();
      expect(cancelBody.data.status).toBe("CANCELLED");
      expect(
        cancelBody.data.targets.every((t: any) => t.status === "CANCELLED"),
      ).toBe(true);

      // Verify cancelPost was called for both engine post IDs
      expect(mockPublishingEngine.cancelPost).toHaveBeenCalledWith(
        targetAlpha.postizPostId,
      );
      expect(mockPublishingEngine.cancelPost).toHaveBeenCalledWith(
        targetBeta.postizPostId,
      );
    });

    it("12. aggregatePostStatus Truth Table: derives lossless parent post statuses", () => {
      // Empty target list defaults to DRAFT
      expect(aggregatePostStatus([])).toBe("DRAFT");

      // Pure drafts
      expect(aggregatePostStatus(["DRAFT", "DRAFT"])).toBe("DRAFT");

      // Active publishing / processing always dominates
      expect(aggregatePostStatus(["PROCESSING", "DRAFT"])).toBe("PROCESSING");
      expect(aggregatePostStatus(["PROCESSING", "PUBLISHED"])).toBe(
        "PROCESSING",
      );
      expect(aggregatePostStatus(["PROCESSING", "FAILED"])).toBe("PROCESSING");
      expect(aggregatePostStatus(["PUBLISHING", "SCHEDULED"])).toBe(
        "PROCESSING",
      );

      // Scheduled posts
      expect(aggregatePostStatus(["SCHEDULED", "SCHEDULED"])).toBe("SCHEDULED");
      expect(aggregatePostStatus(["SCHEDULED", "DRAFT"])).toBe("SCHEDULED");

      // Pure terminal states
      expect(aggregatePostStatus(["PUBLISHED", "PUBLISHED"])).toBe("PUBLISHED");
      expect(aggregatePostStatus(["FAILED", "FAILED"])).toBe("FAILED");
      expect(aggregatePostStatus(["CANCELLED", "CANCELLED"])).toBe("CANCELLED");

      // Mixed terminal states (PARTIAL)
      expect(aggregatePostStatus(["PUBLISHED", "FAILED"])).toBe("PARTIAL");
      expect(aggregatePostStatus(["PUBLISHED", "CANCELLED"])).toBe("PARTIAL");
      expect(aggregatePostStatus(["PUBLISHED", "FAILED", "CANCELLED"])).toBe(
        "PARTIAL",
      );

      // Mixed failure + cancellation (no success) -> FAILED
      expect(aggregatePostStatus(["FAILED", "CANCELLED"])).toBe("FAILED");
    });

    it("13. CSRF Protection: blocks cookie-authenticated mutating requests with forbidden origin", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
            Origin: "https://malicious-attacker.com",
          },
          body: JSON.stringify({
            content: "Cross site forged post",
            channelIds: [channelAId],
          }),
        },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.message).toMatch(/Cross-origin request blocked/i);
    });

    it("14. CSRF Protection: permits cookie-authenticated mutating requests from allowed origin", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookieA,
            Origin: "http://localhost:5173",
          },
          body: JSON.stringify({
            content: "Legitimate post from web frontend",
            channelIds: [channelAId],
          }),
        },
      );

      expect(res.status).toBe(201);
    });

    it("15. Publishing Status: GET /api/v1/publishing/status returns health info", async () => {
      const res = await fetch(`${baseUrl}/api/v1/publishing/status`, {
        headers: { Cookie: cookieA },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.isConnected).toBe(true);
      expect(body.data.message).toBe("Publishing engine connected");
    });

    it("16. Channel Unassignment: Remove channel from Workspace A", async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels/${channelAId}`,
        {
          method: "DELETE",
          headers: { Cookie: cookieA },
        },
      );

      expect(res.status).toBe(200);

      // Verify it is no longer listed
      const listRes = await fetch(
        `${baseUrl}/api/v1/workspaces/${workspaceAId}/channels`,
        {
          headers: { Cookie: cookieA },
        },
      );
      const listBody = await listRes.json();
      expect(listBody.data.some((c: any) => c.id === channelAId)).toBe(false);
    });
  },
);
