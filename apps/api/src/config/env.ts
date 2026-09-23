import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_BASE_URL: z.url().default("http://localhost:4000"),
  WEB_BASE_URL: z.url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

export const env = envSchema.parse(process.env);
