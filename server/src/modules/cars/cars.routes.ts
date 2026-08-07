import { Router } from "express";
import * as carsController from "./cars.controller";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/requireRole";
import { tenantScope } from "../../middlewares/tenantScope";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import {
  carIdParamsSchema,
  createCarSchema,
  listCarsQuerySchema,
  updateCarSchema,
} from "./cars.validators";

export const carsRouter = Router();

carsRouter.get("/brands", asyncHandler(carsController.listBrands));
carsRouter.get("/", validateQuery(listCarsQuerySchema), asyncHandler(carsController.listCars));
carsRouter.get(
  "/:carId",
  validateParams(carIdParamsSchema),
  asyncHandler(carsController.getCarById),
);

carsRouter.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  validateBody(createCarSchema),
  asyncHandler(carsController.createCar),
);

carsRouter.patch(
  "/:carId",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  validateParams(carIdParamsSchema),
  validateBody(updateCarSchema),
  asyncHandler(carsController.updateCar),
);

carsRouter.delete(
  "/:carId",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  validateParams(carIdParamsSchema),
  asyncHandler(carsController.archiveCar),
);
