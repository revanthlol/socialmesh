import "dotenv/config";
import { PostizClient } from "../src/lib/postiz/index.js";

async function runSmokeTest(): Promise<void> {
  const baseUrl = process.env.POSTIZ_BASE_URL || "http://localhost:4008";
  const apiKey = process.env.POSTIZ_API_KEY || "";

  console.log("==================================================");
  console.log("HEADLESS POSTIZ LIVE SMOKE TEST");
  console.log(`Target URL: ${baseUrl}`);
  console.log(
    `API Key:    ${apiKey ? `${apiKey.substring(0, 12)}...` : "(none)"}`,
  );
  console.log("==================================================");

  if (!apiKey) {
    console.error("Error: POSTIZ_API_KEY is not defined in environment.");
    process.exit(1);
  }

  const client = new PostizClient({
    baseUrl,
    apiKey,
    timeoutMs: 8000,
  });

  // Step 1: Health / Connection Check
  console.log("\n[1/5] Testing GET /public/v1/is-connected ...");
  const isConnected = await client.isConnected();
  console.log(`-> isConnected result: ${isConnected}`);
  if (isConnected !== true) {
    throw new Error(
      `Assertion failed: isConnected() must return true, got: ${isConnected}`,
    );
  }

  // Step 2: List Integrations
  console.log("\n[2/5] Testing GET /public/v1/integrations ...");
  const integrations = await client.listIntegrations();
  console.log(`-> Integrations count: ${integrations.length}`);
  console.log(
    "-> Integrations payload:",
    JSON.stringify(integrations, null, 2),
  );

  if (!Array.isArray(integrations) || integrations.length === 0) {
    throw new Error(
      "Assertion failed: listIntegrations() must return at least one integration for headless smoke test.",
    );
  }
  if (!integrations[0]?.id || !integrations[0]?.identifier) {
    throw new Error(
      "Assertion failed: integration item missing required id or identifier.",
    );
  }

  const testIntegrationId = integrations[0].id;

  // Step 3: List Posts
  const now = new Date();
  const startDate = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const endDate = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  console.log(
    `\n[3/5] Testing GET /public/v1/posts (startDate=${startDate}, endDate=${endDate}) ...`,
  );
  const posts = await client.listPosts(startDate, endDate);
  console.log(`-> Posts returned: ${posts.length}`);
  if (!Array.isArray(posts)) {
    throw new Error("Assertion failed: listPosts() must return an array.");
  }

  // Step 4: Create Draft Post & Verify Existence
  console.log(
    `\n[4/5] Testing POST /public/v1/posts with integration "${testIntegrationId}" ...`,
  );
  const draftPayload = {
    content:
      "Empirical headless smoke test draft created by SociaMesh adapter.",
    integrations: [testIntegrationId],
    settings: {
      title: "Headless Smoke Test Post",
    },
  };
  const draftResponse = await client.createDraft(draftPayload);
  console.log("-> Draft created successfully:");
  console.log(JSON.stringify(draftResponse, null, 2));

  const createdPostId = Array.isArray(draftResponse)
    ? draftResponse[0]?.postId || draftResponse[0]?.id
    : draftResponse?.postId || draftResponse?.id;

  if (!createdPostId) {
    throw new Error(
      `Assertion failed: No valid postId returned from createDraft: ${JSON.stringify(draftResponse)}`,
    );
  }

  const postsAfterCreate = await client.listPosts(startDate, endDate);
  const draftFound = postsAfterCreate.some(
    (p) => p.id === createdPostId || p.postId === createdPostId,
  );
  if (!draftFound) {
    throw new Error(
      `Assertion failed: Created draft "${createdPostId}" was not found in listPosts query!`,
    );
  }
  console.log(
    `-> Confirmed draft "${createdPostId}" exists in Postiz posts list.`,
  );

  // Step 5: Delete Draft Post & Verify Removal
  console.log(`\n[5/5] Testing DELETE /public/v1/posts/${createdPostId} ...`);
  const deleteResult = await client.deletePost(createdPostId);
  console.log(
    "-> Normalized deleteResult:",
    JSON.stringify(deleteResult, null, 2),
  );

  if (deleteResult.success !== true) {
    throw new Error(
      `Assertion failed: deletePost() returned success: false: ${JSON.stringify(deleteResult)}`,
    );
  }

  const postsAfterDelete = await client.listPosts(startDate, endDate);
  const stillFound = postsAfterDelete.some(
    (p) => p.id === createdPostId || p.postId === createdPostId,
  );
  if (stillFound) {
    throw new Error(
      `Assertion failed: Draft "${createdPostId}" still exists in listPosts after deletion!`,
    );
  }
  console.log(
    `-> Confirmed draft "${createdPostId}" was successfully removed from Postiz.`,
  );

  console.log("\n==================================================");
  console.log("ALL POSTIZ HEADLESS SMOKE TESTS PASSED SUCCESSFULLY");
  console.log("==================================================");
}

runSmokeTest().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err);
  process.exit(1);
});
