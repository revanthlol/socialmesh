import { z } from "zod";

/**
 * Postiz client configuration options.
 */
export interface PostizConfig {
  /**
   * Base URL for the Postiz backend service (e.g. "http://localhost:3000").
   */
  baseUrl: string;

  /**
   * API key bound to an organization in Postiz.
   */
  apiKey: string;

  /**
   * Default timeout in milliseconds for API requests (defaults to 10,000 ms).
   */
  timeoutMs?: number | undefined;

  /**
   * Optional organization UUID to impersonate via `x-postiz-org` header.
   */
  organizationId?: string | undefined;
}

/**
 * Request options applicable to individual client calls.
 */
export interface PostizRequestOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  organizationId?: string | undefined;
}

// ==========================================
// ZOD SCHEMAS & TYPES FOR POSTIZ API RESPONSES
// ==========================================

export const PostizIsConnectedResponseSchema = z.union([
  z.object({
    valid: z.boolean().optional(),
    connected: z.boolean().optional(),
    status: z.string().optional(),
  }),
  z.boolean(),
]);
export type PostizIsConnectedResponse = z.infer<typeof PostizIsConnectedResponseSchema>;

export const PostizIntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  picture: z.string().nullable().optional(),
  disabled: z.boolean().optional(),
  profile: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type PostizIntegration = z.infer<typeof PostizIntegrationSchema>;

export const PostizListIntegrationsResponseSchema = z.array(PostizIntegrationSchema);
export type PostizListIntegrationsResponse = z.infer<typeof PostizListIntegrationsResponseSchema>;

export const PostizConnectUrlResponseSchema = z.object({
  url: z.string().url(),
});
export type PostizConnectUrlResponse = z.infer<typeof PostizConnectUrlResponseSchema>;

export const PostizSuccessResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  deleted: z.boolean().optional(),
  error: z.unknown().optional(),
  id: z.string().optional(),
});
export type PostizSuccessResponse = z.infer<typeof PostizSuccessResponseSchema>;

export const PostizPostSchema = z.object({
  id: z.string().optional(),
  postId: z.string().optional(),
  state: z.string().optional(),
  publishDate: z.string().optional(),
  content: z.string().optional(),
  releaseId: z.string().nullable().optional(),
  integrations: z.array(z.unknown()).optional(),
  integration: z.unknown().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type PostizPost = z.infer<typeof PostizPostSchema>;

export const PostizListPostsResponseSchema = z.union([
  z.array(PostizPostSchema),
  z.object({
    posts: z.array(PostizPostSchema),
  }).transform((val) => val.posts),
]);
export type PostizListPostsResponse = z.infer<typeof PostizListPostsResponseSchema>;

export const PostizCreatePostResponseSchema = z.union([
  z.array(PostizPostSchema),
  PostizPostSchema,
]);
export type PostizCreatePostResponse = z.infer<typeof PostizCreatePostResponseSchema>;

export const PostizUploadFromUrlResponseSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string().optional(),
  mimeType: z.string().optional(),
});
export type PostizUploadFromUrlResponse = z.infer<typeof PostizUploadFromUrlResponseSchema>;

// ==========================================
// INPUT TYPES FOR POSTIZ MUTATIONS
// ==========================================

export interface PostizIntegrationTarget {
  id: string;
  customContent?: string;
}

export interface PostizCreatePostPayload {
  type: "draft" | "schedule" | "now";
  date?: string;
  content?: string;
  integrations?: (string | PostizIntegrationTarget)[];
  media?: (string | { id: string; path?: string })[];
  settings?: Record<string, unknown>;
}

export interface PostizCreateDraftInput {
  content?: string;
  integrations?: (string | PostizIntegrationTarget)[];
  media?: (string | { id: string; path?: string })[];
  settings?: Record<string, unknown>;
}

export interface PostizSchedulePostInput extends PostizCreateDraftInput {
  /**
   * ISO 8601 timestamp string when the post should be published.
   */
  date: string;
}

export interface PostizPublishNowInput extends PostizCreateDraftInput {}
