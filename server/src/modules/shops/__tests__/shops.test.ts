import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../../createApp";
import { prisma } from "../../../lib/prisma";

const app = createApp();
const createdEmails: string[] = [];

function testEmail(label: string) {
  const email = `test-${label}-${randomUUID()}@test.carrental.dev`;
  createdEmails.push(email);
  return email;
}

const PASSWORD = "Password123!";

afterAll(async () => {
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

describe("GET /api/shops/me", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/shops/me");
    expect(res.status).toBe(401);
  });

  it("rejects a caller with no shop (plain USER)", async () => {
    const token = await signupUser("get-non-admin");

    const res = await request(app).get("/api/shops/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns the caller's own shop", async () => {
    const admin = await signupAdmin("get-own-shop");

    const res = await request(app)
      .get("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shop.id).toBe(admin.shopId);
  });
});

describe("PATCH /api/shops/me", () => {
  it("requires authentication", async () => {
    const res = await request(app).patch("/api/shops/me").send({ name: "New Shop Name" });
    expect(res.status).toBe(401);
  });

  it("rejects a caller with no shop (plain USER)", async () => {
    const token = await signupUser("patch-non-admin");

    const res = await request(app)
      .patch("/api/shops/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Shop Name" });

    expect(res.status).toBe(403);
  });

  it("updates the caller's own shop profile fields", async () => {
    const admin = await signupAdmin("update-fields");

    const res = await request(app)
      .patch("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        name: "Updated Shop Name",
        description: "A great place to rent cars.",
        address: "123 Main St",
        logoUrl: "https://example.com/logo.png",
      });

    expect(res.status).toBe(200);
    expect(res.body.shop.name).toBe("Updated Shop Name");
    expect(res.body.shop.description).toBe("A great place to rent cars.");
    expect(res.body.shop.address).toBe("123 Main St");
    expect(res.body.shop.logoUrl).toBe("https://example.com/logo.png");
  });

  it("allows clearing an optional field with null", async () => {
    const admin = await signupAdmin("clear-field");

    await request(app)
      .patch("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ description: "Temporary description" });

    const res = await request(app)
      .patch("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ description: null });

    expect(res.status).toBe(200);
    expect(res.body.shop.description).toBeNull();
  });

  it("rejects an empty update body", async () => {
    const admin = await signupAdmin("empty-update");

    const res = await request(app)
      .patch("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it("rejects an invalid logoUrl", async () => {
    const admin = await signupAdmin("invalid-logo-url");

    const res = await request(app)
      .patch("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ logoUrl: "not-a-url" });

    expect(res.status).toBe(422);
  });

  it("never lets an admin read another shop's profile", async () => {
    const admin = await signupAdmin("isolation-read-a");
    const otherAdmin = await signupAdmin("isolation-read-b");

    const res = await request(app)
      .get("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shop.id).not.toBe(otherAdmin.shopId);
  });

  it("never lets an admin edit another shop's profile, even by supplying its id in the body", async () => {
    const admin = await signupAdmin("isolation-write-a");
    const otherAdmin = await signupAdmin("isolation-write-b");

    const res = await request(app)
      .patch("/api/shops/me")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Hijacked Name", shopId: otherAdmin.shopId, id: otherAdmin.shopId });

    expect(res.status).toBe(200);
    expect(res.body.shop.id).toBe(admin.shopId);

    const otherShop = await request(app)
      .get("/api/shops/me")
      .set("Authorization", `Bearer ${otherAdmin.accessToken}`);

    expect(otherShop.body.shop.name).not.toBe("Hijacked Name");
  });
});
