import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(100),
  timezone: z.string().trim().min(1).max(50).default("UTC").optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name cannot be empty")
    .max(100)
    .optional(),
  timezone: z.string().trim().min(1).max(50).optional(),
});

export const workspaceParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
