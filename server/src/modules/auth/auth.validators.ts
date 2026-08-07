import { z } from "zod";
import { emailSchema, passwordSchema, phoneSchema } from "../../lib/validators";

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: emailSchema,
    password: passwordSchema,
    phone: phoneSchema.optional(),
    asShop: z.boolean().optional().default(false),
    shopName: z.string().trim().min(2).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.asShop && !data.shopName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shopName"],
        message: "shopName is required when signing up as a shop",
      });
    }
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
