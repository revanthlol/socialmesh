import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

describe("SociaMesh API Integration Smoke Tests", () => {
  let server: Server;
  let baseUrl: string;

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "SuperSecurePassword123!";
  const testDisplayName = "Test Engineer";
  const testWorkspaceName = "Smoke Test Workspace";

  let sessionCookie: string = "";
  let workspaceId: string = "";
  let mediaAssetId: string = "";
  let postId: string = "";

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch {
      // ignore cleanup errors
    }

    await prisma.$disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }, 20000);

  it("1. GET /healthz returns 200 ok", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("2. GET /readyz returns 200 ready with database connected", async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.database).toBe("connected");
  }, 20000);

  it("3. POST /api/v1/auth/register creates user, workspace and sets cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
        workspaceName: testWorkspaceName,
      }),
    });

    expect(res.status).toBe(201);
    const cookieHeader = res.headers.get("set-cookie");
    expect(cookieHeader).toBeTruthy();
    expect(cookieHeader).toContain("sm_session=");

    // Extract cookie
    sessionCookie = cookieHeader!.split(";")[0]!;

    const body = await res.json();
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.user.displayName).toBe(testDisplayName);
    expect(body.data.workspace.name).toBe(testWorkspaceName);
    expect(body.data.workspace.role).toBe("OWNER");
    expect(body.data.session.id).toBeTruthy();

    workspaceId = body.data.workspace.id;
  }, 20000);

  it("4. GET /api/v1/auth/me returns current user and workspaces with valid cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: sessionCookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.workspaces.length).toBeGreaterThanOrEqual(1);
    expect(body.data.workspaces[0].id).toBe(workspaceId);
    expect(body.data.workspaces[0].role).toBe("OWNER");
  });

  it("5. GET /api/v1/auth/me returns 401 without cookie", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("6. Workspaces: GET /api/v1/workspaces lists user workspaces", async () => {
    const res = await fetch(`${baseUrl}/api/v1/workspaces`, {
      headers: { Cookie: sessionCookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((w: any) => w.id === workspaceId)).toBe(true);
  });

  it("7. Workspaces: GET /api/v1/workspaces/:workspaceId gets workspace details", async () => {
    const res = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}`, {
      headers: { Cookie: sessionCookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(workspaceId);
    expect(body.data.name).toBe(testWorkspaceName);
    expect(body.data.stats.memberCount).toBe(1);
  });

  it("8. Workspaces: PATCH /api/v1/workspaces/:workspaceId updates name", async () => {
    const res = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ name: "Updated Test Workspace" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Updated Test Workspace");
  });

  it("9. Cloudflare R2 Media Pipeline: presign, upload to R2, confirm and view", async () => {
    // Step A: Request presigned upload URL
    const presignRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/media/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        originalName: "test-image.png",
        mimeType: "image/png",
        byteSize: 14, // 14 bytes test payload
      }),
    });

    expect(presignRes.status).toBe(201);
    const presignBody = await presignRes.json();
    expect(presignBody.data.uploadUrl).toBeTruthy();
    expect(presignBody.data.mediaAsset.status).toBe("PENDING_UPLOAD");
    expect(presignBody.data.mediaAsset.kind).toBe("IMAGE");

    mediaAssetId = presignBody.data.mediaAsset.id;
    const uploadUrl = presignBody.data.uploadUrl;

    // Step B: Direct PUT to Cloudflare R2 using the presigned URL
    const testPayload = Buffer.from("hello socia-mesh");
    const r2UploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
      },
      body: testPayload,
    });

    expect(r2UploadRes.status).toBe(200);

    // Step C: Confirm upload with API
    const confirmRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/media/${mediaAssetId}/complete`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });

    expect(confirmRes.status).toBe(200);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.data.status).toBe("READY");
    expect(confirmBody.data.viewUrl).toBeTruthy();

    // Step D: Verify signed view URL can actually download the object from R2
    const downloadRes = await fetch(confirmBody.data.viewUrl);
    expect(downloadRes.status).toBe(200);
    const downloadedText = await downloadRes.text();
    expect(downloadedText).toBe("hello socia-mesh");

    // Step E: Verify media is listed
    const listRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/media`, {
      headers: { Cookie: sessionCookie },
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.some((m: any) => m.id === mediaAssetId)).toBe(true);
  }, 25000);

  it("10. Posts/Drafts: create draft, attach media, read, update, delete", async () => {
    // Step A: Create draft
    const createRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        content: "Exciting announcement from SociaMesh! #launch",
        mediaAssetIds: [mediaAssetId],
      }),
    });

    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    expect(createBody.data.status).toBe("DRAFT");
    expect(createBody.data.content).toBe("Exciting announcement from SociaMesh! #launch");
    expect(createBody.data.media.length).toBe(1);
    expect(createBody.data.media[0].asset.id).toBe(mediaAssetId);

    postId = createBody.data.id;

    // Step B: Retrieve draft
    const getRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/posts/${postId}`, {
      headers: { Cookie: sessionCookie },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.id).toBe(postId);
    expect(getBody.data.content).toBe("Exciting announcement from SociaMesh! #launch");

    // Step C: Update draft
    const updateRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/posts/${postId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        content: "Updated announcement text!",
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.data.content).toBe("Updated announcement text!");
    expect(updateBody.data.version).toBe(2);

    // Step D: Delete draft
    const deleteRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/posts/${postId}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });
    expect(deleteRes.status).toBe(200);
  });

  it("11. Media deletion: DELETE /api/v1/workspaces/:workspaceId/media/:mediaId", async () => {
    const res = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/media/${mediaAssetId}`, {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);

    // Verify it is no longer returned in list
    const listRes = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/media`, {
      headers: { Cookie: sessionCookie },
    });
    const listBody = await listRes.json();
    expect(listBody.data.some((m: any) => m.id === mediaAssetId)).toBe(false);
  });

  it("12. Logout: POST /api/v1/auth/logout invalidates session", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    expect(res.status).toBe(200);

    // Subsequent request with invalidated cookie must fail
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    expect(meRes.status).toBe(401);
  });
});
