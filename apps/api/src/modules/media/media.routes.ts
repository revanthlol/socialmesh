import { Router } from "express";
import { mediaController } from "./media.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  requestUploadUrlSchema,
  mediaParamSchema,
  listMediaQuerySchema,
} from "./media.schemas.js";

const router = Router({ mergeParams: true });

router.get(
  "/",
  validate({ query: listMediaQuerySchema }),
  mediaController.list,
);
router.post(
  "/upload-url",
  validate({ body: requestUploadUrlSchema }),
  mediaController.requestUploadUrl,
);
router.get(
  "/:mediaId",
  validate({ params: mediaParamSchema }),
  mediaController.getOne,
);
router.post(
  "/:mediaId/complete",
  validate({ params: mediaParamSchema }),
  mediaController.confirmUpload,
);
router.delete(
  "/:mediaId",
  validate({ params: mediaParamSchema }),
  mediaController.delete,
);

export { router as mediaRouter };
