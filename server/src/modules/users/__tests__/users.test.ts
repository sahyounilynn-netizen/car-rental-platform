import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../../app";
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

async function signupAndGetToken(label: string) {
  const email = testEmail(label);
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: "Profile Test", email, password: PASSWORD });
  return res.body.accessToken as string;
}

describe("PATCH /api/users/me", () => {
  it("requires authentication", async () => {
    const res = await request(app).patch("/api/users/me").send({ name: "New Name" });
    expect(res.status).toBe(401);
  });

  it("updates the caller's own name", async () => {
    const token = await signupAndGetToken("update-name");

    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name" });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Updated Name");
  });

  it("rejects an empty update body", async () => {
    const token = await signupAndGetToken("empty-update");

    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  it("ignores attempts to change role or email through this endpoint", async () => {
    const token = await signupAndGetToken("no-role-escalation");

    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Still Just A User", role: "SUPERADMIN", email: "hacked@test.carrental.dev" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("USER");
    expect(res.body.user.email).not.toBe("hacked@test.carrental.dev");
  });
});
