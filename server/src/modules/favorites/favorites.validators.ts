import { z } from "zod";

export const favoriteCarParamsSchema = z.object({
  carId: z.string().trim().min(1, "carId is required"),
});

