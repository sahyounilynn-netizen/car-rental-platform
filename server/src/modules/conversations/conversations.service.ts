import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError } from "../../lib/errors";
import type { CreateConversationInput, SendMessageInput } from "./conversations.validators";

const messageInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.MessageInclude;

const conversationInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  shop: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      status: true,
    },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: messageInclude,
  },
} satisfies Prisma.ConversationInclude;

async function getConversationForActor(
  conversationId: string,
  actor: { id: string; role: Role; shopId?: string },
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) {
    throw new NotFoundError("Conversation not found");
  }

  const isParticipant =
    actor.role === "USER"
      ? conversation.userId === actor.id
      : actor.role === "ADMIN"
        ? conversation.shopId === actor.shopId
        : true;

  if (!isParticipant) {
    throw new NotFoundError("Conversation not found");
  }

  return conversation;
}

function serializeConversation(conversation: Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>) {
  return conversation;
}

function serializeMessage(message: Prisma.MessageGetPayload<{ include: typeof messageInclude }>) {
  return message;
}

export async function createConversation(userId: string, input: CreateConversationInput) {
  const shop = await prisma.shop.findFirst({
    where: {
      id: input.shopId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!shop) {
    throw new NotFoundError("Shop not found");
  }

  const conversation = await prisma.$transaction(async (tx) => {
    const existing = await tx.conversation.findUnique({
      where: {
        userId_shopId: {
          userId,
          shopId: input.shopId,
        },
      },
      include: conversationInclude,
    });

    if (existing) {
      await tx.message.create({
        data: {
          conversationId: existing.id,
          senderId: userId,
          body: input.body,
        },
      });

      return tx.conversation.update({
        where: { id: existing.id },
        data: {},
        include: conversationInclude,
      });
    }

    return tx.conversation.create({
      data: {
        userId,
        shopId: input.shopId,
        messages: {
          create: {
            senderId: userId,
            body: input.body,
          },
        },
      },
      include: conversationInclude,
    });
  });

  return serializeConversation(conversation);
}

export async function listMyConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    include: conversationInclude,
    orderBy: { updatedAt: "desc" },
  });

  return conversations.map(serializeConversation);
}

export async function listShopConversations(shopId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { shopId },
    include: conversationInclude,
    orderBy: { updatedAt: "desc" },
  });

  return conversations.map(serializeConversation);
}

export async function getConversationById(
  actor: { id: string; role: Role; shopId?: string },
  conversationId: string,
) {
  const conversation = await getConversationForActor(conversationId, actor);
  return serializeConversation(conversation);
}

export async function sendMessage(
  actor: { id: string; role: Role; shopId?: string },
  conversationId: string,
  input: SendMessageInput,
) {
  const conversation = await getConversationForActor(conversationId, actor);

  const senderId =
    actor.role === "ADMIN"
      ? await prisma.user
          .findFirst({
            where: {
              id: actor.id,
              shop: { id: conversation.shopId },
            },
            select: { id: true },
          })
          .then((admin) => {
            if (!admin) {
              throw new ForbiddenError("This admin account does not belong to the conversation shop");
            }
            return admin.id;
          })
      : actor.id;

  const message = await prisma.$transaction(async (tx) => {
    const createdMessage = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        body: input.body,
      },
      include: messageInclude,
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {},
    });

    return createdMessage;
  });

  return serializeMessage(message);
}

export async function markConversationRead(
  actor: { id: string; role: Role; shopId?: string },
  conversationId: string,
) {
  const conversation = await getConversationForActor(conversationId, actor);

  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      senderId: { not: actor.id },
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}
