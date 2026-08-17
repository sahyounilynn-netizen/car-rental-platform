import { randomUUID } from "node:crypto";
import {
  afterAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";
import { createApp } from "../../../createApp";
import { prisma } from "../../../lib/prisma";
import { signAccessToken } from "../../../lib/jwt";

const app = createApp();
const createdEmails: string[] = [];

function testEmail(label: string) {
  const email =
    `test-${label}-${randomUUID()}@test.carrental.dev`;

  createdEmails.push(email);

  return email;
}

const PASSWORD = "Password123!";

afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      actor: {
        email: {
          in: createdEmails,
        },
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        in: createdEmails,
      },
    },
  });

  await prisma.$disconnect();
});

async function signupUser(label: string) {
  const email = testEmail(label);

  const res = await request(app)
    .post("/api/auth/signup")
    .send({
      name: `${label} User`,
      email,
      password: PASSWORD,
    });

  expect(
    res.status,
    JSON.stringify(res.body),
  ).toBe(201);

  return {
    email,
    user: res.body.user,
    accessToken:
      res.body.accessToken as string,
  };
}

async function signupAdmin(label: string) {
  const email = testEmail(label);

  const res = await request(app)
    .post("/api/auth/signup")
    .send({
      name: `${label} Admin`,
      email,
      password: PASSWORD,
      asShop: true,
      shopName: `${label} Shop`,
    });

  expect(
    res.status,
    JSON.stringify(res.body),
  ).toBe(201);

  return {
    email,
    user: res.body.user,
    accessToken:
      res.body.accessToken as string,
  };
}

async function createSuperAdmin(
  label: string,
) {
  const user = await signupUser(label);

  const updated =
    await prisma.user.update({
      where: {
        id: user.user.id,
      },
      data: {
        role: "SUPERADMIN",
      },
      include: {
        shop: true,
      },
    });

  return {
    ...user,
    user: updated,
    accessToken: signAccessToken({
      sub: updated.id,
      role: updated.role,
    }),
  };
}

describe("admin routes", () => {
  it("rejects unauthenticated access", async () => {
    const res = await request(app).get(
      "/api/admin/summary",
    );

    expect(res.status).toBe(401);
  });

  it("rejects USER and ADMIN accounts", async () => {
    const user = await signupUser(
      "admin-rbac-user",
    );

    const admin = await signupAdmin(
      "admin-rbac-admin",
    );

    const [userRes, adminRes] =
      await Promise.all([
        request(app)
          .get("/api/admin/summary")
          .set(
            "Authorization",
            `Bearer ${user.accessToken}`,
          ),

        request(app)
          .get("/api/admin/summary")
          .set(
            "Authorization",
            `Bearer ${admin.accessToken}`,
          ),
      ]);

    expect(userRes.status).toBe(403);
    expect(adminRes.status).toBe(403);
  });

  it("lets SUPERADMIN view the summary", async () => {
    const superAdmin =
      await createSuperAdmin(
        "admin-summary",
      );

    const res = await request(app)
      .get("/api/admin/summary")
      .set(
        "Authorization",
        `Bearer ${superAdmin.accessToken}`,
      );

    expect(res.status).toBe(200);

    expect(
      res.body.summary,
    ).toMatchObject({
      users: expect.any(Number),
      admins: expect.any(Number),
      shops: expect.any(Number),
      cars: expect.any(Number),
      bookings: expect.any(Number),
    });
  });

  it("supports pagination and filters for users without exposing sensitive fields", async () => {
    const uniqueSearch = randomUUID();

    const superAdmin =
      await createSuperAdmin(
        "admin-users-super",
      );

    const matchingUser =
      await signupUser(
        `matching-${uniqueSearch}`,
      );

    const otherUser =
      await signupUser(
        "admin-users-other",
      );

    const matchingAdmin =
      await signupAdmin(
        "admin-users-shopkeeper",
      );

    await prisma.user.update({
      where: {
        id: matchingUser.user.id,
      },
      data: {
        status: "SUSPENDED",
        phone: "+15551231234",
      },
    });

    const res = await request(app)
      .get("/api/admin/users")
      .query({
        page: 1,
        limit: 5,
        search: uniqueSearch,
        role: "USER",
        status: "SUSPENDED",
      })
      .set(
        "Authorization",
        `Bearer ${superAdmin.accessToken}`,
      );

    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.items).toHaveLength(
      1,
    );

    expect(
      res.body.items[0],
    ).toMatchObject({
      id: matchingUser.user.id,
      email: matchingUser.email,
      role: "USER",
      status: "SUSPENDED",
      shop: null,
    });

    expect(
      res.body.items[0].passwordHash,
    ).toBeUndefined();

    expect(
      res.body.items[0].refreshTokens,
    ).toBeUndefined();

    expect(
      res.body.items[0].createdAt,
    ).toEqual(expect.any(String));

    expect(
      res.body.items.map(
        (item: { id: string }) =>
          item.id,
      ),
    ).not.toContain(otherUser.user.id);

    expect(
      res.body.items.map(
        (item: { id: string }) =>
          item.id,
      ),
    ).not.toContain(
      matchingAdmin.user.id,
    );
  });

  it("supports pagination and filters for shops", async () => {
    const uniqueSearch = randomUUID();

    const superAdmin =
      await createSuperAdmin(
        "admin-shops-super",
      );

    const visibleAdmin =
      await signupAdmin(
        `focus-${uniqueSearch}`,
      );

    await signupAdmin("hidden-hangar");

    await prisma.shop.update({
      where: {
        id: visibleAdmin.user.shop.id,
      },
      data: {
        status: "SUSPENDED",
        address: "99 Fleet Road",
        phone: "+15557654321",
      },
    });

    const res = await request(app)
      .get("/api/admin/shops")
      .query({
        page: 1,
        limit: 10,
        search: uniqueSearch,
        status: "SUSPENDED",
      })
      .set(
        "Authorization",
        `Bearer ${superAdmin.accessToken}`,
      );

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(
      1,
    );

    expect(
      res.body.items[0],
    ).toMatchObject({
      id: visibleAdmin.user.shop.id,
      name: `focus-${uniqueSearch} Shop`,
      status: "SUSPENDED",
      address: "99 Fleet Road",
      phone: "+15557654321",
      owner: {
        id: visibleAdmin.user.id,
        name: `focus-${uniqueSearch} Admin`,
        email: visibleAdmin.email,
      },
      carCount: expect.any(Number),
      bookingCount: expect.any(Number),
    });
  });

  it("lets a SuperAdmin suspend and reactivate a user", async () => {
    const superAdmin =
      await createSuperAdmin(
        "admin-user-status-super",
      );

    const target = await signupUser(
      "admin-user-status-target",
    );

    const suspendRes = await request(app)
      .patch(
        `/api/admin/users/${target.user.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${superAdmin.accessToken}`,
      )
      .send({
        status: "SUSPENDED",
      });

    expect(suspendRes.status).toBe(200);

    expect(
      suspendRes.body.user.status,
    ).toBe("SUSPENDED");

    const loginWhileSuspended =
      await request(app)
        .post("/api/auth/login")
        .send({
          email: target.email,
          password: PASSWORD,
        });

    expect(
      loginWhileSuspended.status,
    ).toBe(403);

    const reactivateRes =
      await request(app)
        .patch(
          `/api/admin/users/${target.user.id}/status`,
        )
        .set(
          "Authorization",
          `Bearer ${superAdmin.accessToken}`,
        )
        .send({
          status: "ACTIVE",
        });

    expect(
      reactivateRes.status,
    ).toBe(200);

    expect(
      reactivateRes.body.user.status,
    ).toBe("ACTIVE");
  });

  it("lets a SuperAdmin suspend and reactivate a shop while hiding it from public browsing", async () => {
    const superAdmin =
      await createSuperAdmin(
        "admin-shop-status-super",
      );

    const admin = await signupAdmin(
      "admin-shop-status-target",
    );

    const brand =
      await prisma.carBrand.findFirstOrThrow(
        {
          select: {
            id: true,
          },
        },
      );

    await prisma.car.create({
      data: {
        shopId: admin.user.shop.id,
        brandId: brand.id,
        type: "SUV",
        model: "Atlas",
        year: 2024,
        pricePerDay: 90,
      },
    });

    const beforeSuspend =
      await request(app)
        .get("/api/cars")
        .query({
          shopId:
            admin.user.shop.id,
        });

    expect(
      beforeSuspend.body.items,
    ).toHaveLength(1);

    const suspendRes = await request(app)
      .patch(
        `/api/admin/shops/${admin.user.shop.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${superAdmin.accessToken}`,
      )
      .send({
        status: "SUSPENDED",
      });

    expect(suspendRes.status).toBe(200);

    expect(
      suspendRes.body.shop.status,
    ).toBe("SUSPENDED");

    const afterSuspend =
      await request(app)
        .get("/api/cars")
        .query({
          shopId:
            admin.user.shop.id,
        });

    expect(afterSuspend.status).toBe(200);

    expect(
      afterSuspend.body.items,
    ).toHaveLength(0);

    const reactivateRes =
      await request(app)
        .patch(
          `/api/admin/shops/${admin.user.shop.id}/status`,
        )
        .set(
          "Authorization",
          `Bearer ${superAdmin.accessToken}`,
        )
        .send({
          status: "ACTIVE",
        });

    expect(
      reactivateRes.status,
    ).toBe(200);

    expect(
      reactivateRes.body.shop.status,
    ).toBe("ACTIVE");
  });

  it("does not let a SuperAdmin suspend themselves or another SuperAdmin", async () => {
    const superAdmin =
      await createSuperAdmin(
        "admin-protect-self",
      );

    const otherSuperAdmin =
      await createSuperAdmin(
        "admin-protect-other",
      );

    const [selfRes, otherRes] =
      await Promise.all([
        request(app)
          .patch(
            `/api/admin/users/${superAdmin.user.id}/status`,
          )
          .set(
            "Authorization",
            `Bearer ${superAdmin.accessToken}`,
          )
          .send({
            status: "SUSPENDED",
          }),

        request(app)
          .patch(
            `/api/admin/users/${otherSuperAdmin.user.id}/status`,
          )
          .set(
            "Authorization",
            `Bearer ${superAdmin.accessToken}`,
          )
          .send({
            status: "SUSPENDED",
          }),
      ]);

    expect(selfRes.status).toBe(403);
    expect(otherRes.status).toBe(403);
  });

  it("returns 404s and validation errors for invalid admin mutations", async () => {
    const superAdmin =
      await createSuperAdmin(
        "admin-invalid-status-super",
      );

    const notFoundRes =
      await request(app)
        .patch(
          `/api/admin/users/${randomUUID()}/status`,
        )
        .set(
          "Authorization",
          `Bearer ${superAdmin.accessToken}`,
        )
        .send({
          status: "ACTIVE",
        });

    const validationRes =
      await request(app)
        .patch(
          `/api/admin/shops/${randomUUID()}/status`,
        )
        .set(
          "Authorization",
          `Bearer ${superAdmin.accessToken}`,
        )
        .send({
          status: "DISABLED",
        });

    expect(notFoundRes.status).toBe(404);

    expect(validationRes.status).toBe(
      422,
    );
  });
});