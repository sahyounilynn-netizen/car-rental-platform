import type { Request, Response } from "express";
import * as shopsService from "./shops.service";

export async function getMe(req: Request, res: Response) {
  const shop = await shopsService.getMyShop(req.shopId!);
  res.status(200).json({ shop });
}

export async function updateMe(req: Request, res: Response) {
  const shop = await shopsService.updateMyShop(req.shopId!, req.body);
  res.status(200).json({ shop });
}
