import { Router } from "express";
import { postsController } from "./posts.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  createPostSchema,
  updatePostSchema,
  postParamSchema,
  listPostsQuerySchema,
} from "./posts.schemas.js";

const router = Router({ mergeParams: true });

router.get("/", validate({ query: listPostsQuerySchema }), postsController.list);
router.post("/", validate({ body: createPostSchema }), postsController.create);
router.get("/:postId", validate({ params: postParamSchema }), postsController.getOne);
router.patch("/:postId", validate({ params: postParamSchema, body: updatePostSchema }), postsController.update);
router.delete("/:postId", validate({ params: postParamSchema }), postsController.delete);

export { router as postsRouter };
