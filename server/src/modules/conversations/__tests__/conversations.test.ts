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
  await prisma.conversation.deleteMany({
    where: {
      OR: [
        { user: { email: { in: createdEmails } } },
        { shop: { owner: { email: { in: createdEmails } } } },
      ],
    },
  });
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

describe("Conversations module", () => {
  it("lets a user create a conversation with a shop and an initial message", async () => {
    const admin = await signupAdmin("create-conversation-admin");
    const user = await signupUser("create-conversation-user");

    const res = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        shopId: admin.shopId,
        body: "Hi, is this car available next week?",
      });

    expect(res.status).toBe(201);
    expect(res.body.conversation.userId).toBe(user.userId);
    expect(res.body.conversation.shopId).toBe(admin.shopId);
    expect(res.body.conversation.messages).toHaveLength(1);
    expect(res.body.conversation.messages[0].body).toBe("Hi, is this car available next week?");
  });

  it("reuses the same conversation for the same user and shop", async () => {
    const admin = await signupAdmin("reuse-conversation-admin");
    const user = await signupUser("reuse-conversation-user");

    const firstRes = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        shopId: admin.shopId,
        body: "First message",
      });

    const secondRes = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        shopId: admin.shopId,
        body: "Second message",
      });

    expect(firstRes.status).toBe(201);
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.conversation.id).toBe(firstRes.body.conversation.id);
    expect(secondRes.body.conversation.messages).toHaveLength(2);
  });

  it("lets users list only their own conversations", async () => {
    const admin = await signupAdmin("list-me-admin");
    const user = await signupUser("list-me-user");

    await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        shopId: admin.shopId,
        body: "Need pricing details",
      });

    const res = await request(app)
      .get("/api/conversations/me")
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].userId).toBe(user.userId);
  });

  it("lets shop admins list only their shop conversations", async () => {
    const admin = await signupAdmin("shop-list-admin");
    const user = await signupUser("shop-list-user");

    await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        shopId: admin.shopId,
        body: "Can I pick up late?",
      });

    const res = await request(app)
      .get("/api/conversations/shop")
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].shopId).toBe(admin.shopId);
  });

  it("lets both participants send messages and blocks outsiders", async () => {
    const admin = await signupAdmin("message-admin");
    const otherAdmin = await signupAdmin("message-other-admin");
    const user = await signupUser("message-user");

    const createRes = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        shopId: admin.shopId,
        body: "Opening message",
      });

    const conversationId = createRes.body.conversation.id as string;

    const adminReplyRes = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ body: "Yes, we can help with that." });

    expect(adminReplyRes.status).toBe(201);
    expect(adminReplyRes.body.message.senderId).toBe(admin.userId);

    const outsiderRes = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${otherAdmin.accessToken}`)
      .send({ body: "Intruding admin" });

    expect(outsiderRes.status).toBe(404);
  });

  it("lets a participant fetch a conversation and mark unread messages as read", async () => {
    const admin = await signupAdmin("read-admin");
    const user = await signupUser("read-user");

    const createRes = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        shopId: admin.shopId,
        body: "Do you offer airport drop-off?",
      });

    const conversationId = createRes.body.conversation.id as string;

    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ body: "Yes, airport drop-off is available." });

    const readRes = await request(app)
      .patch(`/api/conversations/${conversationId}/read`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(readRes.status).toBe(204);

    const detailRes = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(detailRes.status).toBe(200);
    const adminMessage = detailRes.body.conversation.messages.find(
      (message: { senderId: string; body: string; readAt: string | null }) =>
        message.senderId === admin.userId && message.body === "Yes, airport drop-off is available.",
    );
    expect(adminMessage?.readAt).toEqual(expect.any(String));
  });
});

