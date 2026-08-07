import { Prisma, CarStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import type { CreateCarInput, ListCarsQuery, UpdateCarInput } from "./cars.validators";

const publicCarInclude = {
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
} satisfies Prisma.CarInclude;

function toNumber(value: Prisma.Decimal | null) {
  return value === null ? null : Number(value);
}

function serializeCar<
  T extends {
    pricePerDay: Prisma.Decimal;
    extraFees: Prisma.Decimal | null;
    images?: { id: string; url: string; position: number; createdAt: Date }[];
  },
>(car: T) {
  return {
    ...car,
    pricePerDay: toNumber(car.pricePerDay),
    extraFees: toNumber(car.extraFees),
  };
}

export async function listBrands() {
  return prisma.carBrand.findMany({ orderBy: { name: "asc" } });
}

export async function listCars(filters: ListCarsQuery) {
  const where: Prisma.CarWhereInput = {
    shop: { status: "ACTIVE" },
    status: filters.status ?? { not: CarStatus.INACTIVE },
    ...(filters.shopId ? { shopId: filters.shopId } : {}),
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(typeof filters.isBookableOnline === "boolean"
      ? { isBookableOnline: filters.isBookableOnline }
      : {}),
    ...(filters.search
      ? {
          model: {
            contains: filters.search,
            mode: "insensitive",
          },
        }
      : {}),
    ...(filters.minPrice || filters.maxPrice
      ? {
          pricePerDay: {
            ...(filters.minPrice ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
    ...(filters.yearFrom || filters.yearTo
      ? {
          year: {
            ...(filters.yearFrom ? { gte: filters.yearFrom } : {}),
            ...(filters.yearTo ? { lte: filters.yearTo } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.car.findMany({
      where,
      include: publicCarInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.car.count({ where }),
  ]);

  return {
    items: items.map(serializeCar),
    meta: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

export async function getCarById(carId: string) {
  const car = await prisma.car.findFirst({
    where: {
      id: carId,
      shop: { status: "ACTIVE" },
      status: { not: CarStatus.INACTIVE },
    },
    include: publicCarInclude,
  });

  if (!car) {
    throw new NotFoundError("Car not found");
  }

  return serializeCar(car);
}

async function assertBrandExists(brandId: string) {
  const brand = await prisma.carBrand.findUnique({ where: { id: brandId } });
  if (!brand) {
    throw new NotFoundError("Car brand not found");
  }
}

export async function createCar(shopId: string, input: CreateCarInput) {
  await assertBrandExists(input.brandId);

  const car = await prisma.car.create({
    data: {
      shopId,
      brandId: input.brandId,
      type: input.type,
      model: input.model,
      year: input.year,
      pricePerDay: input.pricePerDay,
      minRentalDays: input.minRentalDays,
      extraFees: input.extraFees,
      description: input.description,
      isBookableOnline: input.isBookableOnline,
      status: input.status,
      images: {
        create: input.imageUrls.map((url, index) => ({
          url,
          position: index,
        })),
      },
    },
    include: publicCarInclude,
  });

  return serializeCar(car);
}

async function getOwnedCarOrThrow(shopId: string, carId: string) {
  const car = await prisma.car.findFirst({
    where: { id: carId, shopId },
    include: publicCarInclude,
  });

  if (!car) {
    throw new NotFoundError("Car not found");
  }

  return car;
}

export async function updateCar(shopId: string, carId: string, input: UpdateCarInput) {
  await getOwnedCarOrThrow(shopId, carId);

  if (input.brandId) {
    await assertBrandExists(input.brandId);
  }

  const car = await prisma.$transaction(async (tx) => {
    if (input.imageUrls) {
      await tx.carImage.deleteMany({ where: { carId } });
    }

    return tx.car.update({
      where: { id: carId },
      data: {
        ...(input.brandId ? { brandId: input.brandId } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(typeof input.year === "number" ? { year: input.year } : {}),
        ...(typeof input.pricePerDay === "number" ? { pricePerDay: input.pricePerDay } : {}),
        ...(typeof input.minRentalDays === "number" ? { minRentalDays: input.minRentalDays } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "extraFees") ? { extraFees: input.extraFees } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "description")
          ? { description: input.description ?? null }
          : {}),
        ...(typeof input.isBookableOnline === "boolean"
          ? { isBookableOnline: input.isBookableOnline }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.imageUrls
          ? {
              images: {
                create: input.imageUrls.map((url, index) => ({
                  url,
                  position: index,
                })),
              },
            }
          : {}),
      },
      include: publicCarInclude,
    });
  });

  return serializeCar(car);
}

export async function archiveCar(shopId: string, carId: string) {
  await getOwnedCarOrThrow(shopId, carId);

  await prisma.car.update({
    where: { id: carId },
    data: { status: CarStatus.INACTIVE },
  });
}
