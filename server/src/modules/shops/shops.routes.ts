import { Router } from "express";
import * as shopsController from "./shops.controller";
import { updateShopSchema } from "./shops.validators";
import { validateBody } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/requireRole";
import { tenantScope } from "../../middlewares/tenantScope";
import { asyncHandler } from "../../lib/asyncHandler";

export const shopsRouter = Router();

shopsRouter.get(
  "/me",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  asyncHandler(shopsController.getMe),
);

shopsRouter.patch(
  "/me",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  validateBody(updateShopSchema),
  asyncHandler(shopsController.updateMe),
);
