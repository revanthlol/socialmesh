import "dotenv/config";
import pg from "pg";

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = "******";
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

async function bootstrapDatabase(url: string, label: string): Promise<void> {
  const sanitized = sanitizeUrl(url);
  console.log(`[db-bootstrap] Initializing extensions on ${label}: ${sanitized}`);

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();

    const extensions = ["citext", "uuid-ossp", "pgcrypto"];
    for (const ext of extensions) {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "${ext}";`);
      console.log(`[db-bootstrap] Extension "${ext}" ensured on ${label}.`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function main(): Promise<void> {
  const directUrl = process.env.DIRECT_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const shadowUrl = process.env.SHADOW_DATABASE_URL;

  const targetUrls = new Map<string, string>();

  if (directUrl) {
    targetUrls.set(directUrl, "DIRECT_URL");
  }
  if (databaseUrl && !targetUrls.has(databaseUrl)) {
    targetUrls.set(databaseUrl, "DATABASE_URL");
  }
  if (shadowUrl && !targetUrls.has(shadowUrl)) {
    targetUrls.set(shadowUrl, "SHADOW_DATABASE_URL");
  }

  if (targetUrls.size === 0) {
    console.warn("[db-bootstrap] No DIRECT_URL, DATABASE_URL, or SHADOW_DATABASE_URL configured. Skipping.");
    return;
  }

  for (const [url, label] of targetUrls.entries()) {
    try {
      await bootstrapDatabase(url, label);
    } catch (err) {
      console.error(`[db-bootstrap] Failed to bootstrap extensions on ${label}:`, err);
      process.exitCode = 1;
      return;
    }
  }

  console.log("[db-bootstrap] All PostgreSQL extensions successfully verified.");
}

main().catch((err) => {
  console.error("[db-bootstrap] Unexpected error:", err);
  process.exit(1);
});
