import type {
  Request,
  Response,
} from "express";
import * as bookingsService from "./bookings.service";

export async function createOnlineBooking(
  req: Request,
  res: Response,
) {
  const booking =
    await bookingsService.createOnlineBooking(
      req.user!.id,
      req.body,
    );

  res.status(201).json({ booking });
}

export async function createWalkInBooking(
  req: Request,
  res: Response,
) {
  const booking =
    await bookingsService.createWalkInBooking(
      req.user!.id,
      req.shopId!,
      req.body,
    );

  res.status(201).json({ booking });
}

export async function listMyBookings(
  req: Request,
  res: Response,
) {
  const result =
    await bookingsService.listMyBookings(
      req.user!.id,
      req.query as never,
    );

  res.status(200).json(result);
}

export async function listShopBookings(
  req: Request,
  res: Response,
) {
  const result =
    await bookingsService.listShopBookings(
      req.shopId!,
      req.query as never,
    );

  res.status(200).json(result);
}

export async function cancelMyBooking(
  req: Request,
  res: Response,
) {
  const booking =
    await bookingsService.cancelMyBooking(
      req.user!.id,
      req.params.bookingId!,
    );

  res.status(200).json({ booking });
}

export async function updateBookingStatus(
  req: Request,
  res: Response,
) {
  const booking =
    await bookingsService.updateBookingStatus(
      req.shopId!,
      req.params.bookingId!,
      req.body,
    );

  res.status(200).json({ booking });
}