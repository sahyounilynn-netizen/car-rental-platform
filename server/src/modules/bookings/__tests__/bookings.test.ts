import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../../createApp";
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
  const name = `Test Booking Brand ${label} ${randomUUID()}`;
  createdBrandNames.push(name);
  return name;
}

const PASSWORD = "Password123!";

afterAll(async () => {
  await prisma.booking.deleteMany({
    where: {
      OR: [
        { createdBy: { email: { in: createdEmails } } },
        { renterUser: { email: { in: createdEmails } } },
      ],
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
    shopId: res.body.user.shop.id as string,
    userId: res.body.user.id as string,
  };
}

async function signupUser(label: string) {
  const email = testEmail(label);
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: `${label} User`, email, password: PASSWORD });

  return {
    accessToken: res.body.accessToken as string,
    userId: res.body.user.id as string,
  };
}

async function createBrand(label: string) {
  return prisma.carBrand.create({ data: { name: testBrandName(label) } });
}

async function createCarForAdmin(
  adminToken: string,
  brandId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await request(app)
    .post("/api/cars")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      brandId,
      type: "SUV",
      model: "Road Pro",
      year: 2025,
      pricePerDay: 100,
      minRentalDays: 2,
      extraFees: 25,
      isBookableOnline: true,
      ...overrides,
    });

  createdCarIds.push(res.body.car.id);
  return res.body.car;
}

describe("Bookings module", () => {
  it("creates an online booking for the authenticated user and calculates price server-side", async () => {
    const brand = await createBrand("online");
    const admin = await signupAdmin("online-admin");
    const renter = await signupUser("online-renter");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${renter.accessToken}`)
      .send({
        carId: car.id,
        startDate: "2026-08-10T10:00:00.000Z",
        endDate: "2026-08-12T10:00:00.000Z",
        totalPrice: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.booking.source).toBe("ONLINE");
    expect(res.body.booking.status).toBe("PENDING");
    expect(res.body.booking.renterUserId).toBe(renter.userId);
    expect(res.body.booking.totalPrice).toBe(225);
  });

  it("rejects online booking for a car that is not bookable online", async () => {
    const brand = await createBrand("offline");
    const admin = await signupAdmin("offline-admin");
    const renter = await signupUser("offline-renter");
    const car = await createCarForAdmin(admin.accessToken, brand.id, {
      isBookableOnline: false,
    });

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${renter.accessToken}`)
      .send({
        carId: car.id,
        startDate: "2026-08-15T10:00:00.000Z",
        endDate: "2026-08-17T10:00:00.000Z",
      });

    expect(res.status).toBe(403);
  });

  it("rejects overlapping bookings for the same car", async () => {
    const brand = await createBrand("overlap");
    const admin = await signupAdmin("overlap-admin");
    const firstRenter = await signupUser("first-renter");
    const secondRenter = await signupUser("second-renter");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    const firstRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${firstRenter.accessToken}`)
      .send({
        carId: car.id,
        startDate: "2026-08-20T10:00:00.000Z",
        endDate: "2026-08-22T10:00:00.000Z",
      });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${secondRenter.accessToken}`)
      .send({
        carId: car.id,
        startDate: "2026-08-21T10:00:00.000Z",
        endDate: "2026-08-23T10:00:00.000Z",
      });

    expect(secondRes.status).toBe(422);
  });

  it("lets a shop admin create a walk-in booking only for their own shop inventory", async () => {
    const brand = await createBrand("walk-in");
    const admin = await signupAdmin("walkin-admin");
    const otherAdmin = await signupAdmin("walkin-other-admin");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    const res = await request(app)
      .post("/api/bookings/walk-in")
      .set("Authorization", `Bearer ${otherAdmin.accessToken}`)
      .send({
        carId: car.id,
        startDate: "2026-08-25T10:00:00.000Z",
        endDate: "2026-08-27T10:00:00.000Z",
        walkInRenterName: "Counter Customer",
        walkInRenterPhone: "+14155552671",
        walkInRenterLicenseNumber: "LIC-12345",
      });

    expect(res.status).toBe(404);
  });

  it("lists the authenticated user's own bookings", async () => {
    const brand = await createBrand("my-bookings");
    const admin = await signupAdmin("mybookings-admin");
    const renter = await signupUser("mybookings-renter");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${renter.accessToken}`)
      .send({
        carId: car.id,
        startDate: "2026-08-28T10:00:00.000Z",
        endDate: "2026-08-30T10:00:00.000Z",
      });

    const res = await request(app)
      .get("/api/bookings/me")
      .set("Authorization", `Bearer ${renter.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].renterUserId).toBe(renter.userId);
  });

  it("lets an admin list shop bookings and update status, syncing car status", async () => {
    const brand = await createBrand("status");
    const admin = await signupAdmin("status-admin");
    const renter = await signupUser("status-renter");
    const car = await createCarForAdmin(admin.accessToken, brand.id);

    const bookingRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${renter.accessToken}`)
      .send({
        carId: car.id,
        startDate: "2026-09-01T10:00:00.000Z",
        endDate: "2026-09-03T10:00:00.000Z",
      });
    expect(bookingRes.status).toBe(201);

    const listRes = await request(app)
      .get("/api/bookings/shop")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .query({ status: "PENDING" });

    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: bookingRes.body.booking.id })]),
    );

    const activeRes = await request(app)
      .patch(`/api/bookings/${bookingRes.body.booking.id}/status`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "ACTIVE" });

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.booking.status).toBe("ACTIVE");

    const rentedCar = await prisma.car.findUnique({ where: { id: car.id } });
    expect(rentedCar?.status).toBe("RENTED");

    const completedRes = await request(app)
      .patch(`/api/bookings/${bookingRes.body.booking.id}/status`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "COMPLETED" });

    expect(completedRes.status).toBe(200);

    const availableCar = await prisma.car.findUnique({ where: { id: car.id } });
    expect(availableCar?.status).toBe("AVAILABLE");
  });
});
