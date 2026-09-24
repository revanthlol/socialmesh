import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  displayName: z.string().trim().min(1, "Display name is required").max(100),
  workspaceName: z.string().trim().min(1, "Workspace name is required").max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
