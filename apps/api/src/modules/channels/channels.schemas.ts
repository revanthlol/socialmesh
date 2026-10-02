import { z } from "zod";

export const assignChannelSchema = z.object({
  postizIntegrationId: z
    .string()
    .trim()
    .min(1, "Postiz integration ID is required"),
  provider: z.string().trim().min(1, "Provider is required"),
  name: z.string().trim().min(1, "Channel name is required"),
  pictureUrl: z.string().url().nullable().optional(),
});

export const connectUrlSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
});

export const channelParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  channelId: z.string().uuid("Invalid channel ID format"),
});

export const workspaceOnlyParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
});

export const resolveOAuthSchema = z
  .object({
    stateToken: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    provider: z.string().trim().min(1).optional(),
    timezone: z.string().optional(),
    pageId: z.string().optional(),
  })
  .refine((data) => Boolean(data.stateToken || data.state), {
    message: "Either stateToken or state is required",
  });

export type AssignChannelInput = z.infer<typeof assignChannelSchema>;
export type ConnectUrlInput = z.infer<typeof connectUrlSchema>;
export type ResolveOAuthInput = z.infer<typeof resolveOAuthSchema>;
