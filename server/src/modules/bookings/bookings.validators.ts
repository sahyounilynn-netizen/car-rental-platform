import { BookingStatus } from "@prisma/client";
import { z } from "zod";
import { phoneSchema } from "../../lib/validators";

const bookingDateSchema = z.coerce.date();

const bookingWindowFields = {
  startDate: bookingDateSchema,
  endDate: bookingDateSchema,
};

function withValidDateRange<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((data, ctx) => {
    const startDate = data.startDate as Date | undefined;
    const endDate = data.endDate as Date | undefined;
    if (startDate && endDate && endDate <= startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be after startDate",
      });
    }
  });
}

export const bookingIdParamsSchema = z.object({
  bookingId: z.string().trim().min(1, "bookingId is required"),
});

export const createOnlineBookingSchema = withValidDateRange({
  ...bookingWindowFields,
  carId: z.string().trim().min(1, "carId is required"),
});

export type CreateOnlineBookingInput = z.infer<typeof createOnlineBookingSchema>;

export const createWalkInBookingSchema = withValidDateRange({
  ...bookingWindowFields,
  carId: z.string().trim().min(1, "carId is required"),
  walkInRenterName: z.string().trim().min(2, "walkInRenterName is required").max(100),
  walkInRenterPhone: phoneSchema,
  walkInRenterLicenseNumber: z
    .string()
    .trim()
    .min(4, "walkInRenterLicenseNumber is required")
    .max(100),
});

export type CreateWalkInBookingInput = z.infer<typeof createWalkInBookingSchema>;

export const updateBookingStatusSchema = z.object({
  status: z.enum([
    BookingStatus.CONFIRMED,
    BookingStatus.ACTIVE,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ]),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

export const listBookingsQuerySchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
