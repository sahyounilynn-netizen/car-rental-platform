import {
  Prisma,
  Role,
  ShopStatus,
  UserStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  ForbiddenError,
  NotFoundError,
} from "../../lib/errors";
import { createAuditLog } from "../../lib/audit";
import type {
  AdminAuditLogsQuery,
  AdminShopsQuery,
  AdminUsersQuery,
  UpdateAdminShopStatusInput,
  UpdateAdminUserStatusInput,
} from "./admin.validators";

function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(
      1,
      Math.ceil(total / limit),
    ),
  };
}

function buildUserSearchWhere(
  search?: string,
): Prisma.UserWhereInput | undefined {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: search,
          mode: "insensitive",
        },
      },
    ],
  };
}

function buildShopSearchWhere(
  search?: string,
): Prisma.ShopWhereInput | undefined {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        owner: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        owner: {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        owner: {
          phone: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
    ],
  };
}

function buildAuditSearchWhere(
  search?: string,
): Prisma.AuditLogWhereInput | undefined {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      {
        action: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        targetType: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        targetId: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        actor: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        actor: {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
    ],
  };
}

export async function getSummary() {
  const [
    users,
    admins,
    shops,
    cars,
    bookings,
  ] = await prisma.$transaction([
    prisma.user.count({
      where: {
        role: Role.USER,
      },
    }),
    prisma.user.count({
      where: {
        role: Role.ADMIN,
      },
    }),
    prisma.shop.count(),
    prisma.car.count(),
    prisma.booking.count(),
  ]);

  return {
    users,
    admins,
    shops,
    cars,
    bookings,
  };
}

export async function listUsers(
  query: AdminUsersQuery,
) {
  const where: Prisma.UserWhereInput = {
    role:
      query.role ??
      {
        in: [
          Role.USER,
          Role.ADMIN,
        ],
      },
    ...(query.status
      ? {
          status: query.status,
        }
      : {}),
    ...buildUserSearchWhere(query.search),
  };

  const [items, total] =
    await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          shop: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        skip:
          (query.page - 1) *
          query.limit,
        take: query.limit,
      }),
      prisma.user.count({
        where,
      }),
    ]);

  return {
    items,
    meta: buildPaginationMeta(
      query.page,
      query.limit,
      total,
    ),
  };
}

export async function listShops(
  query: AdminShopsQuery,
) {
  const where: Prisma.ShopWhereInput = {
    ...(query.status
      ? {
          status: query.status,
        }
      : {}),
    ...buildShopSearchWhere(query.search),
  };

  const [items, total] =
    await prisma.$transaction([
      prisma.shop.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          address: true,
          phone: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
          _count: {
            select: {
              cars: true,
              bookings: true,
            },
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        skip:
          (query.page - 1) *
          query.limit,
        take: query.limit,
      }),
      prisma.shop.count({
        where,
      }),
    ]);

  return {
    items: items.map((shop) => ({
      id: shop.id,
      name: shop.name,
      status: shop.status,
      address: shop.address,
      phone: shop.phone,
      createdAt: shop.createdAt,
      owner: shop.owner,
      carCount: shop._count.cars,
      bookingCount:
        shop._count.bookings,
    })),
    meta: buildPaginationMeta(
      query.page,
      query.limit,
      total,
    ),
  };
}

export async function listAuditLogs(
  query: AdminAuditLogsQuery,
) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.actorId
      ? {
          actorId: query.actorId,
        }
      : {}),
    ...(query.action
      ? {
          action: query.action,
        }
      : {}),
    ...(query.targetType
      ? {
          targetType:
            query.targetType,
        }
      : {}),
    ...buildAuditSearchWhere(query.search),
  };

  const [items, total] =
    await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        skip:
          (query.page - 1) *
          query.limit,
        take: query.limit,
      }),
      prisma.auditLog.count({
        where,
      }),
    ]);

  return {
    items,
    meta: buildPaginationMeta(
      query.page,
      query.limit,
      total,
    ),
  };
}

export async function updateUserStatus(
  actorId: string,
  userId: string,
  input: UpdateAdminUserStatusInput,
) {
  if (actorId === userId) {
    throw new ForbiddenError(
      "You cannot change your own account status",
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        shop: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

  if (!user) {
    throw new NotFoundError(
      "User not found",
    );
  }

  if (user.role === Role.SUPERADMIN) {
    throw new ForbiddenError(
      "You cannot change another SuperAdmin account",
    );
  }

  const updatedUser =
    await prisma.$transaction(
      async (tx) => {
        const nextUser =
          await tx.user.update({
            where: {
              id: userId,
            },
            data: {
              status: input.status,
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              status: true,
              createdAt: true,
              shop: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          });

        if (
          input.status ===
          UserStatus.SUSPENDED
        ) {
          await tx.refreshToken.updateMany({
            where: {
              userId,
              revokedAt: null,
            },
            data: {
              revokedAt: new Date(),
            },
          });
        }

        await createAuditLog(tx, {
          actorId,
          action:
            "USER_STATUS_UPDATED",
          targetType: "USER",
          targetId: userId,
          metadata: {
            previousStatus: user.status,
            nextStatus: input.status,
            targetEmail: user.email,
            targetRole: user.role,
          },
        });

        return nextUser;
      },
    );

  return updatedUser;
}

export async function updateShopStatus(
  actorId: string,
  shopId: string,
  input: UpdateAdminShopStatusInput,
) {
  const existing =
    await prisma.shop.findUnique({
      where: {
        id: shopId,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

  if (!existing) {
    throw new NotFoundError(
      "Shop not found",
    );
  }

  const shop =
    await prisma.$transaction(
      async (tx) => {
        const updated =
          await tx.shop.update({
            where: {
              id: shopId,
            },
            data: {
              status:
                input.status as ShopStatus,
            },
            select: {
              id: true,
              name: true,
              status: true,
              address: true,
              phone: true,
              createdAt: true,
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  status: true,
                },
              },
              _count: {
                select: {
                  cars: true,
                  bookings: true,
                },
              },
            },
          });

        await createAuditLog(tx, {
          actorId,
          action:
            "SHOP_STATUS_UPDATED",
          targetType: "SHOP",
          targetId: shopId,
          metadata: {
            previousStatus:
              existing.status,
            nextStatus: input.status,
            shopName: existing.name,
          },
        });

        return updated;
      },
    );

  return {
    id: shop.id,
    name: shop.name,
    status: shop.status,
    address: shop.address,
    phone: shop.phone,
    createdAt: shop.createdAt,
    owner: shop.owner,
    carCount: shop._count.cars,
    bookingCount:
      shop._count.bookings,
  };
}