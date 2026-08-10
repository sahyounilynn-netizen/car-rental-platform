import { BookingSource, BookingStatus, CarStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors";
import type {
  CreateOnlineBookingInput,
  CreateWalkInBookingInput,
  ListBookingsQuery,
  UpdateBookingStatusInput,
} from "./bookings.validators";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const bookingInclude = {
  car: {
    include: {
      brand: true,
      images: { orderBy: { position: "asc" as const } },
      shop: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  },
  renterUser: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.BookingInclude;

function decimalToNumber(value: Prisma.Decimal | null) {
  return value === null ? null : Number(value);
}

function serializeBooking<
  T extends {
    totalPrice: Prisma.Decimal;
    car: {
      pricePerDay: Prisma.Decimal;
      extraFees: Prisma.Decimal | null;
    };
  },
>(booking: T) {
  return {
    ...booking,
    totalPrice: decimalToNumber(booking.totalPrice)!,
    car: {
      ...booking.car,
      pricePerDay: decimalToNumber(booking.car.pricePerDay)!,
      extraFees: decimalToNumber(booking.car.extraFees),
    },
  };
}

function calculateRentalDays(startDate: Date, endDate: Date) {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

async function getCarForBooking(carId: string) {
  const car = await prisma.car.findFirst({
    where: {
      id: carId,
      shop: { status: "ACTIVE" },
      status: { notIn: [CarStatus.MAINTENANCE, CarStatus.INACTIVE] },
    },
    include: {
      shop: true,
    },
  });

  if (!car) {
    throw new NotFoundError("Car not found");
  }

  return car;
}

async function assertNoOverlap(carId: string, startDate: Date, endDate: Date, excludeBookingId?: string) {
  const conflict = await prisma.booking.findFirst({
    where: {
      carId,
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE] },
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
  });

  if (conflict) {
    throw new ValidationError([
      { field: "startDate", message: "Car is already booked for the selected dates" },
    ]);
  }
}

function assertMinRentalDays(minRentalDays: number, actualDays: number) {
  if (actualDays < minRentalDays) {
    throw new ValidationError([
      {
        field: "endDate",
        message: `Booking must be at least ${minRentalDays} day${minRentalDays === 1 ? "" : "s"}`,
      },
    ]);
  }
}

function calculateTotalPrice(
  rentalDays: number,
  pricePerDay: Prisma.Decimal,
  extraFees: Prisma.Decimal | null,
) {
  return Number(pricePerDay) * rentalDays + Number(extraFees ?? 0);
}

async function recomputeCarStatus(tx: Prisma.TransactionClient, carId: string) {
  const car = await tx.car.findUnique({ where: { id: carId } });
  if (!car || car.status === CarStatus.INACTIVE || car.status === CarStatus.MAINTENANCE) {
    return;
  }

  const hasActiveBooking = await tx.booking.findFirst({
    where: {
      carId,
      status: BookingStatus.ACTIVE,
    },
    select: { id: true },
  });

  await tx.car.update({
    where: { id: carId },
    data: { status: hasActiveBooking ? CarStatus.RENTED : CarStatus.AVAILABLE },
  });
}

export async function createOnlineBooking(userId: string, input: CreateOnlineBookingInput) {
  const car = await getCarForBooking(input.carId);

  if (!car.isBookableOnline) {
    throw new ForbiddenError("This car is not available for online booking");
  }

  const rentalDays = calculateRentalDays(input.startDate, input.endDate);
  assertMinRentalDays(car.minRentalDays, rentalDays);
  await assertNoOverlap(car.id, input.startDate, input.endDate);

  const totalPrice = calculateTotalPrice(rentalDays, car.pricePerDay, car.extraFees);

  const booking = await prisma.booking.create({
    data: {
      carId: car.id,
      shopId: car.shopId,
      renterUserId: userId,
      startDate: input.startDate,
      endDate: input.endDate,
      totalPrice,
      status: BookingStatus.PENDING,
      source: BookingSource.ONLINE,
      createdByUserId: userId,
    },
    include: bookingInclude,
  });

  return serializeBooking(booking);
}

export async function createWalkInBooking(
  adminUserId: string,
  shopId: string,
  input: CreateWalkInBookingInput,
) {
  const car = await getCarForBooking(input.carId);
  if (car.shopId !== shopId) {
    throw new NotFoundError("Car not found");
  }

  const rentalDays = calculateRentalDays(input.startDate, input.endDate);
  assertMinRentalDays(car.minRentalDays, rentalDays);
  await assertNoOverlap(car.id, input.startDate, input.endDate);

  const totalPrice = calculateTotalPrice(rentalDays, car.pricePerDay, car.extraFees);

  const booking = await prisma.booking.create({
    data: {
      carId: car.id,
      shopId: car.shopId,
      renterUserId: null,
      walkInRenterName: input.walkInRenterName,
      walkInRenterPhone: input.walkInRenterPhone,
      walkInRenterLicenseNumber: input.walkInRenterLicenseNumber,
      startDate: input.startDate,
      endDate: input.endDate,
      totalPrice,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.WALK_IN,
      createdByUserId: adminUserId,
    },
    include: bookingInclude,
  });

  return serializeBooking(booking);
}

export async function listMyBookings(userId: string, query: ListBookingsQuery) {
  const where: Prisma.BookingWhereInput = {
    renterUserId: userId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    items: items.map(serializeBooking),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function listShopBookings(shopId: string, query: ListBookingsQuery) {
  const where: Prisma.BookingWhereInput = {
    shopId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    items: items.map(serializeBooking),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function updateBookingStatus(
  shopId: string,
  bookingId: string,
  input: UpdateBookingStatusInput,
) {
  const existing = await prisma.booking.findFirst({
    where: { id: bookingId, shopId },
  });

  if (!existing) {
    throw new NotFoundError("Booking not found");
  }

  const booking = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: input.status },
      include: bookingInclude,
    });

    await recomputeCarStatus(tx, existing.carId);

    return updated;
  });

  return serializeBooking(booking);
}
