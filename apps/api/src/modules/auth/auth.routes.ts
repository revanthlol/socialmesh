import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { registerSchema, loginSchema } from "./auth.schemas.js";

const router = Router();

router.post("/register", validate({ body: registerSchema }), authController.register);
router.post("/login", validate({ body: loginSchema }), authController.login);
router.post("/logout", authController.logout);
router.post("/logout-all", requireAuth, authController.logoutAll);
router.get("/me", requireAuth, authController.me);

export { router as authRouter };
