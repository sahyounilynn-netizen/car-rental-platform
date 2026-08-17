import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/requireRole";
import { tenantScope } from "../../middlewares/tenantScope";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import * as bookingsController from "./bookings.controller";
import {
  bookingIdParamsSchema,
  createOnlineBookingSchema,
  createWalkInBookingSchema,
  listBookingsQuerySchema,
  updateBookingStatusSchema,
} from "./bookings.validators";

export const bookingsRouter = Router();

bookingsRouter.post(
  "/",
  authenticate,
  requireRole("USER"),
  validateBody(createOnlineBookingSchema),
  asyncHandler(
    bookingsController.createOnlineBooking,
  ),
);

bookingsRouter.get(
  "/me",
  authenticate,
  requireRole("USER"),
  validateQuery(listBookingsQuerySchema),
  asyncHandler(
    bookingsController.listMyBookings,
  ),
);

bookingsRouter.patch(
  "/me/:bookingId/cancel",
  authenticate,
  requireRole("USER"),
  validateParams(bookingIdParamsSchema),
  asyncHandler(
    bookingsController.cancelMyBooking,
  ),
);

bookingsRouter.get(
  "/shop",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  validateQuery(listBookingsQuerySchema),
  asyncHandler(
    bookingsController.listShopBookings,
  ),
);

bookingsRouter.post(
  "/walk-in",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  validateBody(createWalkInBookingSchema),
  asyncHandler(
    bookingsController.createWalkInBooking,
  ),
);

bookingsRouter.patch(
  "/:bookingId/status",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  validateParams(bookingIdParamsSchema),
  validateBody(updateBookingStatusSchema),
  asyncHandler(
    bookingsController.updateBookingStatus,
  ),
);