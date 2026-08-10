import { z } from "zod";

export const conversationIdParamsSchema = z.object({
  conversationId: z.string().trim().min(1, "conversationId is required"),
});

export const createConversationSchema = z.object({
  shopId: z.string().trim().min(1, "shopId is required"),
  body: z.string().trim().min(1, "body is required").max(5000),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "body is required").max(5000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

