import "dotenv/config";
import { PostizClient } from "../src/lib/postiz/index.js";

async function runSmokeTest(): Promise<void> {
  const baseUrl = process.env.POSTIZ_BASE_URL || "http://localhost:4008";
  const apiKey = process.env.POSTIZ_API_KEY || "";

  console.log("==================================================");
  console.log("HEADLESS POSTIZ LIVE SMOKE TEST");
  console.log(`Target URL: ${baseUrl}`);
  console.log(`API Key:    ${apiKey ? `${apiKey.substring(0, 12)}...` : "(none)"}`);
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
  if (!isConnected) {
    throw new Error("Failed to connect to Postiz headless API.");
  }

  // Step 2: List Integrations
  console.log("\n[2/5] Testing GET /public/v1/integrations ...");
  const integrations = await client.listIntegrations();
  console.log(`-> Integrations count: ${integrations.length}`);
  console.log("-> Integrations payload:", JSON.stringify(integrations, null, 2));

  if (integrations.length === 0) {
    console.warn("Warning: No integrations found in Postiz. Further post operations may fail if no target exists.");
  }

  const testIntegrationId = integrations[0]?.id;

  // Step 3: List Posts
  const now = new Date();
  const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`\n[3/5] Testing GET /public/v1/posts (startDate=${startDate}, endDate=${endDate}) ...`);
  const posts = await client.listPosts(startDate, endDate);
  console.log(`-> Posts returned: ${posts.length}`);
  console.log("-> Posts response:", JSON.stringify(posts, null, 2));

  // Step 4: Create Draft Post
  if (testIntegrationId) {
    console.log(`\n[4/5] Testing POST /public/v1/posts with integration "${testIntegrationId}" ...`);
    const draftPayload = {
      content: "Empirical headless smoke test draft created by SociaMesh adapter.",
      integrations: [testIntegrationId],
      settings: {
        title: "Headless Smoke Test Post",
      },
    };
    const draftResponse = await client.createDraft(draftPayload);
    console.log("-> Draft created successfully:");
    console.log(JSON.stringify(draftResponse, null, 2));

    const createdPostId = Array.isArray(draftResponse)
      ? (draftResponse[0]?.postId || draftResponse[0]?.id)
      : (draftResponse?.postId || draftResponse?.id);

    // Step 5: Delete Draft Post
    if (createdPostId) {
      console.log(`\n[5/5] Testing DELETE /public/v1/posts/${createdPostId} ...`);
      const deleteResult = await client.deletePost(createdPostId);
      console.log("-> Post deleted successfully:");
      console.log(JSON.stringify(deleteResult, null, 2));
    }
  } else {
    console.log("\n[4/5] & [5/5] Skipped post create/delete test (no integrations configured).");
  }

  console.log("\n==================================================");
  console.log("ALL POSTIZ HEADLESS SMOKE TESTS PASSED SUCCESSFULLY");
  console.log("==================================================");
}

runSmokeTest().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err);
  process.exit(1);
});
