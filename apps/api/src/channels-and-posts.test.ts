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
        .mockResolvedValue(
          "https://auth.example.com/oauth/authorize?state=xyz",
        ),
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
      importMedia: vi.fn().mockResolvedValue({
        id: "mock_media_1",
        url: "https://cdn.example.com/imported.png",
      }),
    };

    beforeAll(async () => {
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

      // Test Status Reconciliation Endpoint
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

      expect(targetAlpha.postizPostId).toBe("mock_pub_postiz_int_alpha_1");
      expect(targetBeta.postizPostId).toBe("mock_pub_postiz_int_beta_2");
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
        "mock_pub_postiz_int_alpha_1",
      );
      expect(mockPublishingEngine.cancelPost).toHaveBeenCalledWith(
        "mock_pub_postiz_int_beta_2",
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
