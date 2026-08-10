import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";

const app = createApp();
const createdEmails: string[] = [];
const createdBrandNames: string[] = [];
const createdCarIds: string[] = [];

function testEmail(label: string) {
  const email = `test-${label}-${randomUUID()}@test.carrental.dev`;
  createdEmails.push(email);
  return email;
}

function testBrandName(label: string) {
  const name = `Test Favorite Brand ${label} ${randomUUID()}`;
  createdBrandNames.push(name);
  return name;
}

const PASSWORD = "Password123!";

afterAll(async () => {
  await prisma.favorite.deleteMany({
    where: {
      user: {
        email: {
          in: createdEmails,
        },
      },
    },
  });
  await prisma.car.deleteMany({ where: { id: { in: createdCarIds } } });
  await prisma.carBrand.deleteMany({ where: { name: { in: createdBrandNames } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

async function signupAdmin(label: string) {
  const email = testEmail(label);
  const res = await request(app).post("/api/auth/signup").send({
    name: `${label} Admin`,
    email,
    password: PASSWORD,
    asShop: true,
    shopName: `${label} Shop`,
  });

  return {
    accessToken: res.body.accessToken as string,
  };
}

async function signupUser(label: string) {
  const email = testEmail(label);
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: `${label} User`, email, password: PASSWORD });

  return {
    accessToken: res.body.accessToken as string,
  };
}

async function createBrand(label: string) {
  return prisma.carBrand.create({ data: { name: testBrandName(label) } });
}

async function createCarForAdmin(adminToken: string, brandId: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/cars")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      brandId,
      type: "SEDAN",
      model: "Favorite Cruiser",
      year: 2025,
      pricePerDay: 85,
      imageUrls: ["https://example.com/favorite-cruiser.jpg"],
      ...overrides,
    });

  createdCarIds.push(res.body.car.id);
  return res.body.car;
}

describe("Favorites module", () => {
  it("requires authentication to list favorites", async () => {
    const res = await request(app).get("/api/favorites");
    expect(res.status).toBe(401);
  });

  it("lets a user add a favorite and list it", async () => {
    const brand = await createBrand("add");
    const admin = await signupAdmin("favorite-admin");
    const user = await signupUser("favorite-user");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    const addRes = await request(app)
      .post(`/api/favorites/${car.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(addRes.status).toBe(201);
    expect(addRes.body.favorite.carId).toBe(car.id);

    const listRes = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.favorites).toHaveLength(1);
    expect(listRes.body.favorites[0].car.id).toBe(car.id);
    expect(listRes.body.favorites[0].car.pricePerDay).toBe(85);
  });

  it("does not duplicate the same favorite on repeated add", async () => {
    const brand = await createBrand("dedupe");
    const admin = await signupAdmin("dedupe-admin");
    const user = await signupUser("dedupe-user");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    const firstRes = await request(app)
      .post(`/api/favorites/${car.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    const secondRes = await request(app)
      .post(`/api/favorites/${car.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(firstRes.status).toBe(201);
    expect(secondRes.status).toBe(201);

    const storedFavorites = await prisma.favorite.count({
      where: {
        carId: car.id,
      },
    });
    expect(storedFavorites).toBe(1);
  });

  it("rejects favoriting an inactive car", async () => {
    const brand = await createBrand("inactive");
    const admin = await signupAdmin("inactive-admin");
    const user = await signupUser("inactive-user");
    const car = await createCarForAdmin(admin.accessToken, brand.id, {
      status: "INACTIVE",
    });

    const res = await request(app)
      .post(`/api/favorites/${car.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("lets a user remove their own favorite", async () => {
    const brand = await createBrand("remove");
    const admin = await signupAdmin("remove-admin");
    const user = await signupUser("remove-user");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    await request(app)
      .post(`/api/favorites/${car.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    const removeRes = await request(app)
      .delete(`/api/favorites/${car.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(removeRes.status).toBe(204);

    const listRes = await request(app)
      .get("/api/favorites")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.favorites).toHaveLength(0);
  });

  it("returns 404 when removing a favorite that does not exist", async () => {
    const user = await signupUser("missing-remove-user");

    const res = await request(app)
      .delete(`/api/favorites/${randomUUID()}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(404);
  });
});

