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
  const name = `Test Brand ${label} ${randomUUID()}`;
  createdBrandNames.push(name);
  return name;
}

const PASSWORD = "Password123!";

afterAll(async () => {
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
    shopId: res.body.user.shop.id as string,
  };
}

async function signupUser(label: string) {
  const email = testEmail(label);
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: `${label} User`, email, password: PASSWORD });

  return res.body.accessToken as string;
}

async function createBrand(label: string) {
  return prisma.carBrand.create({
    data: { name: testBrandName(label) },
  });
}

describe("Cars module", () => {
  it("lists car brands publicly", async () => {
    const brand = await createBrand("list");

    const res = await request(app).get("/api/cars/brands");

    expect(res.status).toBe(200);
    expect(res.body.brands).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: brand.id, name: brand.name })]),
    );
  });

  it("lets a shop admin create a car for their own shop only", async () => {
    const brand = await createBrand("create");
    const admin = await signupAdmin("create-car");
    const otherAdmin = await signupAdmin("other-shop");

    const res = await request(app)
      .post("/api/cars")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        shopId: otherAdmin.shopId,
        brandId: brand.id,
        type: "SUV",
        model: "Atlas X",
        year: 2025,
        pricePerDay: 89.99,
        minRentalDays: 2,
        extraFees: 10,
        description: "Great for families",
        imageUrls: ["https://example.com/atlas-front.jpg", "https://example.com/atlas-side.jpg"],
      });

    expect(res.status).toBe(201);
    expect(res.body.car.shopId).toBe(admin.shopId);
    expect(res.body.car.shopId).not.toBe(otherAdmin.shopId);
    expect(res.body.car.images).toHaveLength(2);
    createdCarIds.push(res.body.car.id);
  });

  it("blocks non-admin users from creating inventory", async () => {
    const brand = await createBrand("user-create");
    const userToken = await signupUser("plain-user");

    const res = await request(app)
      .post("/api/cars")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        brandId: brand.id,
        type: "SEDAN",
        model: "City One",
        year: 2024,
        pricePerDay: 55,
      });

    expect(res.status).toBe(403);
  });

  it("lists public cars with filters and pagination metadata", async () => {
    const brand = await createBrand("list-cars");
    const admin = await signupAdmin("list-admin");

    const createRes = await request(app)
      .post("/api/cars")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        brandId: brand.id,
        type: "LUXURY",
        model: "Skyline Elite",
        year: 2026,
        pricePerDay: 150,
        imageUrls: ["https://example.com/skyline.jpg"],
      });
    createdCarIds.push(createRes.body.car.id);

    const res = await request(app)
      .get("/api/cars")
      .query({ shopId: admin.shopId, search: "Skyline", page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createRes.body.car.id, model: "Skyline Elite" })]),
    );
    expect(res.body.meta).toMatchObject({ page: 1, limit: 10 });
  });

  it("returns car details publicly", async () => {
    const brand = await createBrand("detail");
    const admin = await signupAdmin("detail-admin");

    const createRes = await request(app)
      .post("/api/cars")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        brandId: brand.id,
        type: "COUPE",
        model: "Comet GT",
        year: 2025,
        pricePerDay: 110,
        imageUrls: ["https://example.com/comet.jpg"],
      });
    createdCarIds.push(createRes.body.car.id);

    const res = await request(app).get(`/api/cars/${createRes.body.car.id}`);

    expect(res.status).toBe(200);
    expect(res.body.car).toMatchObject({
      id: createRes.body.car.id,
      model: "Comet GT",
      brand: { id: brand.id, name: brand.name },
      shop: { id: admin.shopId },
    });
  });

  it("prevents one shop admin from updating another shop's car", async () => {
    const brand = await createBrand("update-cross-shop");
    const ownerAdmin = await signupAdmin("owner-admin");
    const otherAdmin = await signupAdmin("other-admin");

    const createRes = await request(app)
      .post("/api/cars")
      .set("Authorization", `Bearer ${ownerAdmin.accessToken}`)
      .send({
        brandId: brand.id,
        type: "VAN",
        model: "Mover",
        year: 2023,
        pricePerDay: 72,
      });
    createdCarIds.push(createRes.body.car.id);

    const res = await request(app)
      .patch(`/api/cars/${createRes.body.car.id}`)
      .set("Authorization", `Bearer ${otherAdmin.accessToken}`)
      .send({ model: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("archives a car instead of hard-deleting it", async () => {
    const brand = await createBrand("archive");
    const admin = await signupAdmin("archive-admin");

    const createRes = await request(app)
      .post("/api/cars")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        brandId: brand.id,
        type: "HATCHBACK",
        model: "Quiet Zip",
        year: 2024,
        pricePerDay: 48,
      });
    createdCarIds.push(createRes.body.car.id);

    const archiveRes = await request(app)
      .delete(`/api/cars/${createRes.body.car.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(archiveRes.status).toBe(204);

    const detailRes = await request(app).get(`/api/cars/${createRes.body.car.id}`);
    expect(detailRes.status).toBe(404);

    const storedCar = await prisma.car.findUnique({ where: { id: createRes.body.car.id } });
    expect(storedCar?.status).toBe("INACTIVE");
  });
});
