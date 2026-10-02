import crypto from "node:crypto";
import {
  S3Client,
  type S3ClientConfig,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const s3Config: S3ClientConfig = {
  region: "auto",
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || "",
  },
};

if (env.R2_ENDPOINT) {
  s3Config.endpoint = env.R2_ENDPOINT;
}

const r2Client = new S3Client(s3Config);

export const ALLOWED_MIME_TYPES = {
  "image/jpeg": {
    kind: "IMAGE" as const,
    ext: "jpg",
    maxSize: 20 * 1024 * 1024,
  },
  "image/png": {
    kind: "IMAGE" as const,
    ext: "png",
    maxSize: 20 * 1024 * 1024,
  },
  "image/webp": {
    kind: "IMAGE" as const,
    ext: "webp",
    maxSize: 20 * 1024 * 1024,
  },
  "image/gif": {
    kind: "IMAGE" as const,
    ext: "gif",
    maxSize: 20 * 1024 * 1024,
  },
  "video/mp4": {
    kind: "VIDEO" as const,
    ext: "mp4",
    maxSize: 100 * 1024 * 1024,
  },
  "video/quicktime": {
    kind: "VIDEO" as const,
    ext: "mov",
    maxSize: 100 * 1024 * 1024,
  },
} as const;

export type SupportedMimeType = keyof typeof ALLOWED_MIME_TYPES;

export function isSupportedMimeType(mime: string): mime is SupportedMimeType {
  return mime in ALLOWED_MIME_TYPES;
}

export function generateObjectKey(
  workspaceId: string,
  assetId: string,
  ext: string,
): string {
  // Prevent path traversal and arbitrary keys
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "");
  return `workspaces/${workspaceId}/media/${assetId}.${safeExt}`;
}

export async function createPresignedUploadUrl(
  objectKey: string,
  mimeType: string,
  byteSize: number,
  expiresInSeconds = 900, // 15 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: mimeType,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

export async function createPresignedViewUrl(
  objectKey: string,
  expiresInSeconds = 3600, // 1 hour
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: objectKey,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

export async function checkObjectExists(objectKey: string): Promise<{
  exists: boolean;
  size?: number | undefined;
  contentType?: string | undefined;
}> {
  try {
    const head = await r2Client.send(
      new HeadObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey,
      }),
    );
    return {
      exists: true,
      size: head.ContentLength,
      contentType: head.ContentType,
    };
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    throw err;
  }
}

export async function deleteObjectFromR2(objectKey: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
    }),
  );
}

export interface DurableMediaPayload {
  mediaAssetId: string;
  workspaceId: string;
  objectKey: string;
  exp: number; // Unix timestamp in seconds
}

export function createDurableMediaToken(payload: DurableMediaPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifyDurableMediaToken(
  token: string,
): DurableMediaPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    if (!data || !signature) return null;
    const expectedSignature = crypto
      .createHmac("sha256", env.SESSION_SECRET)
      .update(data)
      .digest("base64url");

    const sigBuf = Buffer.from(signature, "utf-8");
    const expBuf = Buffer.from(expectedSignature, "utf-8");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: DurableMediaPayload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8"),
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSeconds) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

export function createDurableMediaUrl(
  workspaceId: string,
  assetId: string,
  objectKey: string,
  filename: string,
  targetDate?: Date,
): string {
  const baseTime = targetDate ? targetDate.getTime() : Date.now();
  const expSeconds = Math.floor(baseTime / 1000) + 7 * 86400; // Target date + 7-day grace window

  const token = createDurableMediaToken({
    mediaAssetId: assetId,
    workspaceId,
    objectKey,
    exp: expSeconds,
  });

  const safeFilename = encodeURIComponent(filename || "media.bin");
  const baseUrl = (env.APP_BASE_URL || "http://localhost:4000").replace(
    /\/$/,
    "",
  );
  return `${baseUrl}/api/v1/media/durable/${token}/${safeFilename}`;
}

export async function getMediaObjectStream(objectKey: string) {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: objectKey,
  });
  const res = await r2Client.send(command);
  return {
    body: res.Body,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}
