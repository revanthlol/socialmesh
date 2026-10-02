import { Router } from "express";
import { channelsController } from "./channels.controller.js";
import { requireWorkspaceRole } from "../../middleware/workspace.js";
import { validate } from "../../middleware/validate.js";
import {
  assignChannelSchema,
  connectUrlSchema,
  channelParamSchema,
} from "./channels.schemas.js";

const router = Router({ mergeParams: true });

// Members can list assigned channels for the workspace
router.get("/", channelsController.listAssigned);

// Only OWNER can see unassigned/available Postiz integrations
router.get(
  "/available",
  requireWorkspaceRole(["OWNER"]),
  channelsController.listAvailable,
);

// Only OWNER can assign a channel to the workspace
router.post(
  "/",
  requireWorkspaceRole(["OWNER"]),
  validate({ body: assignChannelSchema }),
  channelsController.assign,
);

// Only OWNER can get OAuth connect URL
router.post(
  "/connect-url",
  requireWorkspaceRole(["OWNER"]),
  validate({ body: connectUrlSchema }),
  channelsController.getConnectUrl,
);

// Members can view analytics for an assigned channel
router.get(
  "/:channelId/analytics",
  validate({ params: channelParamSchema }),
  channelsController.getAnalytics,
);

// Only OWNER can unassign a channel
router.delete(
  "/:channelId",
  requireWorkspaceRole(["OWNER"]),
  validate({ params: channelParamSchema }),
  channelsController.removeAssignment,
);

// Only OWNER can permanently disconnect an integration
router.delete(
  "/:channelId/disconnect",
  requireWorkspaceRole(["OWNER"]),
  validate({ params: channelParamSchema }),
  channelsController.disconnect,
);

// Workspace-scoped resolve
router.post("/oauth/resolve", channelsController.resolvePending);

const oauthRouter = Router();
oauthRouter.post("/oauth/resolve", channelsController.resolvePending);

export { router as channelsRouter, oauthRouter as channelsOAuthRouter };
