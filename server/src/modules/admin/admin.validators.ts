import {
  Role,
  ShopStatus,
  UserStatus,
} from "@prisma/client";
import { z } from "zod";

const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20),
});

export const adminUsersQuerySchema =
  paginationQuerySchema.extend({
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
    role: z
      .enum([Role.USER, Role.ADMIN])
      .optional(),
    status: z
      .nativeEnum(UserStatus)
      .optional(),
  });

export type AdminUsersQuery = z.infer<
  typeof adminUsersQuerySchema
>;

export const adminShopsQuerySchema =
  paginationQuerySchema.extend({
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
    status: z
      .nativeEnum(ShopStatus)
      .optional(),
  });

export type AdminShopsQuery = z.infer<
  typeof adminShopsQuerySchema
>;

export const adminAuditLogsQuerySchema =
  paginationQuerySchema.extend({
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
    actorId: z
      .string()
      .trim()
      .min(1)
      .optional(),
    action: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
    targetType: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
  });

export type AdminAuditLogsQuery = z.infer<
  typeof adminAuditLogsQuerySchema
>;

export const adminUserIdParamsSchema =
  z.object({
    userId: z
      .string()
      .trim()
      .min(1, "userId is required"),
  });

export const adminShopIdParamsSchema =
  z.object({
    shopId: z
      .string()
      .trim()
      .min(1, "shopId is required"),
  });

export const updateAdminUserStatusSchema =
  z.object({
    status: z.nativeEnum(UserStatus),
  });

export type UpdateAdminUserStatusInput =
  z.infer<
    typeof updateAdminUserStatusSchema
  >;

export const updateAdminShopStatusSchema =
  z.object({
    status: z.nativeEnum(ShopStatus),
  });

export type UpdateAdminShopStatusInput =
  z.infer<
    typeof updateAdminShopStatusSchema
  >;