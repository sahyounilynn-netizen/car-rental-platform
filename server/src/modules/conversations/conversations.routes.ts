import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/requireRole";
import { tenantScope } from "../../middlewares/tenantScope";
import { validateBody, validateParams } from "../../middlewares/validate";
import * as conversationsController from "./conversations.controller";
import {
  conversationIdParamsSchema,
  createConversationSchema,
  sendMessageSchema,
} from "./conversations.validators";

export const conversationsRouter = Router();

conversationsRouter.post(
  "/",
  authenticate,
  requireRole("USER"),
  validateBody(createConversationSchema),
  asyncHandler(conversationsController.createConversation),
);

conversationsRouter.get(
  "/me",
  authenticate,
  requireRole("USER"),
  asyncHandler(conversationsController.listMyConversations),
);

conversationsRouter.get(
  "/shop",
  authenticate,
  requireRole("ADMIN"),
  tenantScope,
  asyncHandler(conversationsController.listShopConversations),
);

conversationsRouter.get(
  "/:conversationId",
  authenticate,
  requireRole("USER", "ADMIN"),
  validateParams(conversationIdParamsSchema),
  asyncHandler(conversationsController.getConversationById),
);

conversationsRouter.post(
  "/:conversationId/messages",
  authenticate,
  requireRole("USER", "ADMIN"),
  validateParams(conversationIdParamsSchema),
  validateBody(sendMessageSchema),
  asyncHandler(conversationsController.sendMessage),
);

conversationsRouter.patch(
  "/:conversationId/read",
  authenticate,
  requireRole("USER", "ADMIN"),
  validateParams(conversationIdParamsSchema),
  asyncHandler(conversationsController.markConversationRead),
);
