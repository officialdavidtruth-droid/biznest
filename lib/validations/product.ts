import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2, "Product name is required").max(120),
  categoryId: z.string().cuid().optional().or(z.literal("")),
  type: z.enum(["PHYSICAL", "DIGITAL", "RENTAL"]),
  description: z.string().min(10, "Add a bit more detail (10+ characters)"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  compareAtPrice: z.coerce.number().positive().optional().or(z.literal("")),
  currency: z.string().default("NGN"),
  images: z.array(z.string().url()).max(8, "Up to 8 images"),
  isPublished: z.boolean().default(true),
  quantity: z.coerce.number().int().min(0).default(0),
  digitalFileUrl: z.string().url().optional().or(z.literal("")),
  rentalPeriodUnit: z.enum(["day", "week", "month"]).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
