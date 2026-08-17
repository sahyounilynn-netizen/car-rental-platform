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

function getRefreshCookie(res: request.Response): string {
  const cookie = res.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("Expected a Set-Cookie header in the response");
  return cookie;
}

const PASSWORD = "Password123!";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("POST /api/auth/signup", () => {
  it("creates a USER and returns an access token + refresh cookie", async () => {
    const email = testEmail("signup-user");

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Test User", email, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe("USER");
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^refreshToken=/);
  });

  it("creates an ADMIN + Shop transactionally when asShop is true", async () => {
    const email = testEmail("signup-admin");

    const res = await request(app).post("/api/auth/signup").send({
      name: "Test Admin",
      email,
      password: PASSWORD,
      asShop: true,
      shopName: "Test Shop",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("ADMIN");
    expect(res.body.user.shop).toMatchObject({ name: "Test Shop" });
  });

  it("rejects asShop signup without a shopName", async () => {
    const email = testEmail("signup-noshop");

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Test Admin", email, password: PASSWORD, asShop: true });

    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "shopName" })]),
    );
  });

  it("ignores a client-supplied role and never creates a SUPERADMIN", async () => {
    const email = testEmail("signup-role-injection");

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Sneaky", email, password: PASSWORD, role: "SUPERADMIN" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("USER");
  });

  it("rejects a weak password", async () => {
    const email = testEmail("signup-weak-password");

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Test User", email, password: "weak" });

    expect(res.status).toBe(422);
  });

  it("rejects a duplicate email with 409", async () => {
    const email = testEmail("signup-dup");
    await request(app).post("/api/auth/signup").send({ name: "First", email, password: PASSWORD });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Second", email, password: PASSWORD });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const email = testEmail("login-ok");
    await request(app)
      .post("/api/auth/signup")
      .send({ name: "Login Ok", email, password: PASSWORD });

    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects an incorrect password", async () => {
    const email = testEmail("login-badpw");
    await request(app)
      .post("/api/auth/signup")
      .send({ name: "Login Bad", email, password: PASSWORD });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "WrongPass123" });

    expect(res.status).toBe(401);
  });

  it("rejects login for a suspended user", async () => {
    const email = testEmail("login-suspended");
    await request(app)
      .post("/api/auth/signup")
      .send({ name: "Suspended", email, password: PASSWORD });
    await prisma.user.update({ where: { email }, data: { status: "SUSPENDED" } });

    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for a valid token", async () => {
    const email = testEmail("me-ok");
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Me Ok", email, password: PASSWORD });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signupRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});

describe("POST /api/auth/refresh", () => {
  it("rotates the refresh token and issues a new access token", async () => {
    const email = testEmail("refresh-ok");
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Refresh Ok", email, password: PASSWORD });
    const cookie = getRefreshCookie(signupRes);

    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    // Refresh tokens embed a unique jti, so the rotated cookie must always differ,
    // even if the access token happens to be byte-identical (same claims + same second).
    expect(getRefreshCookie(refreshRes)).not.toBe(cookie);
  });

  it("rejects reuse of an already-rotated refresh token and revokes the session", async () => {
    const email = testEmail("refresh-reuse");
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Refresh Reuse", email, password: PASSWORD });
    const originalCookie = getRefreshCookie(signupRes);

    const firstRefreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie);
    expect(firstRefreshRes.status).toBe(200);
    const rotatedCookie = getRefreshCookie(firstRefreshRes);

    // Replaying the original (now-revoked) refresh cookie must fail.
    const reuseRes = await request(app).post("/api/auth/refresh").set("Cookie", originalCookie);
    expect(reuseRes.status).toBe(401);

    // Reuse-detection revokes the whole session family, including the rotated cookie.
    const secondRefreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", rotatedCookie);
    expect(secondRefreshRes.status).toBe(401);
  });

  it("rejects a missing refresh cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the refresh token so it can no longer be used", async () => {
    const email = testEmail("logout-ok");
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Logout Ok", email, password: PASSWORD });
    const cookie = getRefreshCookie(signupRes);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${signupRes.body.accessToken}`)
      .set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(refreshRes.status).toBe(401);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});
