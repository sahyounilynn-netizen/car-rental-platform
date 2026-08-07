import type { Request, Response } from "express";
import * as carsService from "./cars.service";

export async function listBrands(_req: Request, res: Response) {
  const brands = await carsService.listBrands();
  res.status(200).json({ brands });
}

export async function listCars(req: Request, res: Response) {
  const result = await carsService.listCars(req.query as never);
  res.status(200).json(result);
}

export async function getCarById(req: Request, res: Response) {
  const car = await carsService.getCarById(req.params.carId!);
  res.status(200).json({ car });
}

export async function createCar(req: Request, res: Response) {
  const car = await carsService.createCar(req.shopId!, req.body);
  res.status(201).json({ car });
}

export async function updateCar(req: Request, res: Response) {
  const car = await carsService.updateCar(req.shopId!, req.params.carId!, req.body);
  res.status(200).json({ car });
}

export async function archiveCar(req: Request, res: Response) {
  await carsService.archiveCar(req.shopId!, req.params.carId!);
  res.status(204).send();
}
