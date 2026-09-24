import { Router } from "express";
import { workspaceController } from "./workspace.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspace.js";
import { validate } from "../../middleware/validate.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceParamSchema,
} from "./workspace.schemas.js";
import { mediaRouter } from "../media/media.routes.js";
import { postsRouter } from "../posts/posts.routes.js";
import { channelsRouter } from "../channels/channels.routes.js";

const router = Router();

// All workspace routes require an authenticated user
router.use(requireAuth);

router.get("/", workspaceController.list);
router.post(
  "/",
  validate({ body: createWorkspaceSchema }),
  workspaceController.create,
);

router.get(
  "/:workspaceId",
  validate({ params: workspaceParamSchema }),
  requireWorkspaceMember(),
  workspaceController.getOne,
);

router.patch(
  "/:workspaceId",
  validate({ params: workspaceParamSchema, body: updateWorkspaceSchema }),
  requireWorkspaceMember(),
  requireWorkspaceRole(["OWNER"]),
  workspaceController.update,
);

router.get(
  "/:workspaceId/members",
  validate({ params: workspaceParamSchema }),
  requireWorkspaceMember(),
  workspaceController.listMembers,
);

// Mount workspace-scoped media, posts, and channels routes
router.use("/:workspaceId/media", requireWorkspaceMember(), mediaRouter);
router.use("/:workspaceId/posts", requireWorkspaceMember(), postsRouter);
router.use("/:workspaceId/channels", requireWorkspaceMember(), channelsRouter);

export { router as workspaceRouter };
