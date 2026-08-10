import { CarStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";

const favoriteInclude = {
  car: {
    include: {
      brand: true,
      images: { orderBy: { position: "asc" as const } },
      shop: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.FavoriteInclude;

function decimalToNumber(value: Prisma.Decimal | null) {
  return value === null ? null : Number(value);
}

function serializeFavorite<
  T extends {
    car: {
      pricePerDay: Prisma.Decimal;
      extraFees: Prisma.Decimal | null;
    };
  },
>(favorite: T) {
  return {
    ...favorite,
    car: {
      ...favorite.car,
      pricePerDay: decimalToNumber(favorite.car.pricePerDay)!,
      extraFees: decimalToNumber(favorite.car.extraFees),
    },
  };
}

async function assertCarCanBeFavorited(carId: string) {
  const car = await prisma.car.findFirst({
    where: {
      id: carId,
      shop: { status: "ACTIVE" },
      status: { not: CarStatus.INACTIVE },
    },
    select: { id: true },
  });

  if (!car) {
    throw new NotFoundError("Car not found");
  }
}

export async function listFavorites(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: favoriteInclude,
    orderBy: { createdAt: "desc" },
  });

  return favorites.map(serializeFavorite);
}

export async function addFavorite(userId: string, carId: string) {
  await assertCarCanBeFavorited(carId);

  const favorite = await prisma.favorite.upsert({
    where: {
      userId_carId: {
        userId,
        carId,
      },
    },
    update: {},
    create: {
      userId,
      carId,
    },
    include: favoriteInclude,
  });

  return serializeFavorite(favorite);
}

export async function removeFavorite(userId: string, carId: string) {
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_carId: {
        userId,
        carId,
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Favorite not found");
  }

  await prisma.favorite.delete({
    where: {
      userId_carId: {
        userId,
        carId,
      },
    },
  });
}

