import { z } from "zod";
import { phoneSchema } from "../../lib/validators";

export const updateShopSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    address: z.string().trim().max(200).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    logoUrl: z.string().trim().url("logoUrl must be a valid URL").nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateShopInput = z.infer<typeof updateShopSchema>;
