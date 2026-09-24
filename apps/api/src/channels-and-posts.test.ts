import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { postsService } from "./modules/posts/posts.service.js";
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
      schedulePost: vi.fn().mockResolvedValue({
        enginePostId: "mock_sched_postiz_1",
        status: "SCHEDULED",
        scheduledFor: "2026-12-01T12:00:00.000Z",
      }),
      publishNow: vi.fn().mockResolvedValue({
        enginePostId: "mock_pub_postiz_1",
        status: "PUBLISHING",
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

    it("6. Connect URL: Workspace A owner requests OAuth connect URL", async () => {
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

    it("9. Publishing Engine: Publish Now marks post PUBLISHED and records postizPostId", async () => {
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
      expect(pubBody.data.status).toBe("PUBLISHED");
      expect(pubBody.data.postizPostId).toBe("mock_pub_postiz_1");
      expect(pubBody.data.publishedAt).toBeTruthy();
      expect(mockPublishingEngine.publishNow).toHaveBeenCalled();
    });

    it("10. Scheduling: Schedule Post hands off to engine and marks SCHEDULED", async () => {
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
      expect(schedBody.data.postizPostId).toBe("mock_sched_postiz_1");
      expect(mockPublishingEngine.schedulePost).toHaveBeenCalled();

      // 11. Cancellation: Cancel scheduled post
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
      expect(mockPublishingEngine.cancelPost).toHaveBeenCalledWith(
        "mock_sched_postiz_1",
      );
    });

    it("12. Publishing Status: GET /api/v1/publishing/status returns health info", async () => {
      const res = await fetch(`${baseUrl}/api/v1/publishing/status`, {
        headers: { Cookie: cookieA },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.isConnected).toBe(true);
      expect(body.data.message).toBe("Publishing engine connected");
    });

    it("13. Channel Unassignment: Remove channel from Workspace A", async () => {
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
      expect(listBody.data.length).toBe(0);
    });
  },
);
