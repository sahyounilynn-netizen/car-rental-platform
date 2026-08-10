import type { Request, Response } from "express";
import * as favoritesService from "./favorites.service";

export async function listFavorites(req: Request, res: Response) {
  const favorites = await favoritesService.listFavorites(req.user!.id);
  res.status(200).json({ favorites });
}

export async function addFavorite(req: Request, res: Response) {
  const favorite = await favoritesService.addFavorite(req.user!.id, req.params.carId!);
  res.status(201).json({ favorite });
}

export async function removeFavorite(req: Request, res: Response) {
  await favoritesService.removeFavorite(req.user!.id, req.params.carId!);
  res.status(204).send();
}

