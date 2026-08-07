import { CarStatus, CarType } from "@prisma/client";
import { z } from "zod";

const currentYear = new Date().getFullYear() + 1;

const imageUrlSchema = z.string().trim().url("Image URL must be a valid URL");

export const carIdParamsSchema = z.object({
  carId: z.string().trim().min(1, "carId is required"),
});

export const createCarSchema = z.object({
  brandId: z.string().trim().min(1, "brandId is required"),
  type: z.nativeEnum(CarType),
  model: z.string().trim().min(1, "Model is required").max(100),
  year: z.coerce.number().int().min(1990).max(currentYear),
  pricePerDay: z.coerce.number().positive("pricePerDay must be greater than 0"),
  minRentalDays: z.coerce.number().int().min(1).default(1),
  extraFees: z.coerce.number().min(0).optional(),
  description: z.string().trim().max(2000).optional(),
  isBookableOnline: z.boolean().optional().default(true),
  status: z.nativeEnum(CarStatus).optional().default(CarStatus.AVAILABLE),
  imageUrls: z.array(imageUrlSchema).max(10).optional().default([]),
});

export type CreateCarInput = z.infer<typeof createCarSchema>;

export const updateCarSchema = z
  .object({
    brandId: z.string().trim().min(1).optional(),
    type: z.nativeEnum(CarType).optional(),
    model: z.string().trim().min(1).max(100).optional(),
    year: z.coerce.number().int().min(1990).max(currentYear).optional(),
    pricePerDay: z.coerce.number().positive().optional(),
    minRentalDays: z.coerce.number().int().min(1).optional(),
    extraFees: z.coerce.number().min(0).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isBookableOnline: z.boolean().optional(),
    status: z.nativeEnum(CarStatus).optional(),
    imageUrls: z.array(imageUrlSchema).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateCarInput = z.infer<typeof updateCarSchema>;

export const listCarsQuerySchema = z.object({
  shopId: z.string().trim().min(1).optional(),
  brandId: z.string().trim().min(1).optional(),
  type: z.nativeEnum(CarType).optional(),
  status: z.nativeEnum(CarStatus).optional(),
  isBookableOnline: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().trim().min(1).max(100).optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  yearFrom: z.coerce.number().int().min(1990).max(currentYear).optional(),
  yearTo: z.coerce.number().int().min(1990).max(currentYear).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListCarsQuery = z.infer<typeof listCarsQuerySchema>;
