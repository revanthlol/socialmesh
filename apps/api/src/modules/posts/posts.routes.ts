import { Router } from "express";
import { postsController } from "./posts.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  createPostSchema,
  updatePostSchema,
  schedulePostSchema,
  postParamSchema,
  listPostsQuerySchema,
} from "./posts.schemas.js";

const router = Router({ mergeParams: true });

router.get(
  "/",
  validate({ query: listPostsQuerySchema }),
  postsController.list,
);
router.post("/", validate({ body: createPostSchema }), postsController.create);
router.get(
  "/:postId",
  validate({ params: postParamSchema }),
  postsController.getOne,
);
router.patch(
  "/:postId",
  validate({ params: postParamSchema, body: updatePostSchema }),
  postsController.update,
);
router.delete(
  "/:postId",
  validate({ params: postParamSchema }),
  postsController.delete,
);

router.post(
  "/:postId/publish",
  validate({ params: postParamSchema }),
  postsController.publish,
);
router.post(
  "/:postId/schedule",
  validate({ params: postParamSchema, body: schedulePostSchema }),
  postsController.schedule,
);
router.post(
  "/:postId/cancel",
  validate({ params: postParamSchema }),
  postsController.cancel,
);
router.post(
  "/:postId/reconcile",
  validate({ params: postParamSchema }),
  postsController.reconcile,
);

export { router as postsRouter };
