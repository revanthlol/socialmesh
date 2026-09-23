import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.string().default("http://localhost:4000"),
  WEB_BASE_URL: z.string().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(16).default("dev-session-secret-change-in-production-min32"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("socialmesh-media"),
  R2_ENDPOINT: z.string().optional(),
});

export const env = envSchema.parse(process.env);
