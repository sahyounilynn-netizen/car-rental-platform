import type { Request, Response } from "express";
import * as usersService from "./users.service";

export async function updateMe(req: Request, res: Response) {
  const user = await usersService.updateMe(req.user!.id, req.body);
  res.status(200).json({ user });
}
