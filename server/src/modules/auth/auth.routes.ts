import { Router } from "express";
import * as authController from "./auth.controller";
import { signupSchema, loginSchema } from "./auth.validators";
import { validateBody } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import { signupLimiter, loginLimiter } from "../../middlewares/rateLimit";
import { asyncHandler } from "../../lib/asyncHandler";

export const authRouter = Router();

authRouter.post(
  "/signup",
  signupLimiter,
  validateBody(signupSchema),
  asyncHandler(authController.signup),
);
authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login),
);
// /refresh relies on possession of an httpOnly cookie, not guessable credentials,
// and is called silently/repeatedly by legitimate clients — general limiter only.
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", authenticate, asyncHandler(authController.logout));
authRouter.get("/me", authenticate, asyncHandler(authController.me));
