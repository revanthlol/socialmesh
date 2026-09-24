import { z } from "zod";

export const createPostSchema = z.object({
  content: z.string().trim().min(1, "Post content cannot be empty").max(10000),
  mediaAssetIds: z.array(z.string().uuid()).max(10).optional().default([]),
  channelIds: z.array(z.string().uuid()).optional().default([]),
  scheduledFor: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().min(1).max(50).default("UTC").optional(),
});

export const updatePostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Post content cannot be empty")
    .max(10000)
    .optional(),
  mediaAssetIds: z.array(z.string().uuid()).max(10).optional(),
  channelIds: z.array(z.string().uuid()).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().min(1).max(50).optional(),
});

export const schedulePostSchema = z
  .object({
    scheduledFor: z
      .string()
      .datetime({ message: "scheduledFor must be a valid ISO datetime" })
      .optional(),
  })
  .optional()
  .default({});

export const postParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  postId: z.string().uuid("Invalid post ID format"),
});

export const listPostsQuerySchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "SCHEDULED",
      "PUBLISHING",
      "PUBLISHED",
      "FAILED",
      "CANCELLED",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SchedulePostInputSchema = z.infer<typeof schedulePostSchema>;
