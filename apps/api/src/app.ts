import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { workspaceRouter } from "./modules/workspaces/workspace.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());

  const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS origin not allowed: " + origin));
      },
    }),
  );

  app.use(cookieParser());
  app.use(pinoHttp());
  app.use(express.json({ limit: "2mb" }));

  // Health and Readiness checks
  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/readyz", async (_request, response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      response.status(200).json({ status: "ready", database: "connected" });
    } catch (err: any) {
      response.status(503).json({ status: "not_ready", error: err.message });
    }
  });

  // API v1 Routes
  const apiV1Router = express.Router();
  apiV1Router.use("/auth", authRouter);
  apiV1Router.use("/workspaces", workspaceRouter);

  app.use("/api/v1", apiV1Router);

  // 404 handler for unknown routes
  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
