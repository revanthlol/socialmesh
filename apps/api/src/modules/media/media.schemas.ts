import { z } from "zod";

export const requestUploadUrlSchema = z.object({
  originalName: z.string().trim().min(1, "Original filename is required").max(255),
  mimeType: z.string().trim().min(1, "MIME type is required"),
  byteSize: z.coerce.number().int().positive("File size must be greater than zero"),
});

export const mediaParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  mediaId: z.string().uuid("Invalid media ID format"),
});

export const workspaceOnlyParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
});

export const listMediaQuerySchema = z.object({
  kind: z.enum(["IMAGE", "VIDEO"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30).optional(),
});

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;
