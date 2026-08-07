import { Router } from "express";
import * as usersController from "./users.controller";
import { updateProfileSchema } from "./users.validators";
import { validateBody } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import { asyncHandler } from "../../lib/asyncHandler";

export const usersRouter = Router();

usersRouter.patch(
  "/me",
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(usersController.updateMe),
);
