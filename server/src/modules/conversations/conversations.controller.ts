import type { Request, Response } from "express";
import * as conversationsService from "./conversations.service";

export async function createConversation(req: Request, res: Response) {
  const conversation = await conversationsService.createConversation(req.user!.id, req.body);
  res.status(201).json({ conversation });
}

export async function listMyConversations(req: Request, res: Response) {
  const conversations = await conversationsService.listMyConversations(req.user!.id);
  res.status(200).json({ conversations });
}

export async function listShopConversations(req: Request, res: Response) {
  const conversations = await conversationsService.listShopConversations(req.shopId!);
  res.status(200).json({ conversations });
}

export async function getConversationById(req: Request, res: Response) {
  const conversation = await conversationsService.getConversationById(req.user!, req.params.conversationId!);
  res.status(200).json({ conversation });
}

export async function sendMessage(req: Request, res: Response) {
  const message = await conversationsService.sendMessage(req.user!, req.params.conversationId!, req.body);
  res.status(201).json({ message });
}

export async function markConversationRead(req: Request, res: Response) {
  await conversationsService.markConversationRead(req.user!, req.params.conversationId!);
  res.status(204).send();
}

