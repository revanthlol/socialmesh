import { Router } from "express";
import { getPublishingEngine } from "../../services/publishing.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();
const engine = getPublishingEngine();

router.get("/status", requireAuth, async (_req, res) => {
  const start = Date.now();
  try {
    const isHealthy = await engine.isHealthy({ timeoutMs: 3000 });
    const latencyMs = Date.now() - start;
    if (isHealthy) {
      return res.status(200).json({
        data: {
          isConnected: true,
          latencyMs,
          message: "Publishing engine connected",
        },
      });
    }
    return res.status(200).json({
      data: {
        isConnected: false,
        latencyMs,
        message: "Publishing temporarily unavailable",
      },
    });
  } catch {
    const latencyMs = Date.now() - start;
    return res.status(200).json({
      data: {
        isConnected: false,
        latencyMs,
        message: "Publishing temporarily unavailable",
      },
    });
  }
});

export { router as publishingRouter };
