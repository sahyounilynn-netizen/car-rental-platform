import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/requireRole";
import { validateParams } from "../../middlewares/validate";
import * as favoritesController from "./favorites.controller";
import { favoriteCarParamsSchema } from "./favorites.validators";

export const favoritesRouter = Router();

favoritesRouter.get(
  "/",
  authenticate,
  requireRole("USER"),
  asyncHandler(favoritesController.listFavorites),
);

favoritesRouter.post(
  "/:carId",
  authenticate,
  requireRole("USER"),
  validateParams(favoriteCarParamsSchema),
  asyncHandler(favoritesController.addFavorite),
);

favoritesRouter.delete(
  "/:carId",
  authenticate,
  requireRole("USER"),
  validateParams(favoriteCarParamsSchema),
  asyncHandler(favoritesController.removeFavorite),
);