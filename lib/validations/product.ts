import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2, "Product name is required").max(120),
  categoryId: z.string().cuid().optional().or(z.literal("")),
  type: z.enum(["PHYSICAL", "DIGITAL", "RENTAL"]),
  description: z.string().min(10, "Add a bit more detail (10+ characters)").max(255, "Keep the short description under 255 characters"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  compareAtPrice: z.coerce.number().positive().optional().or(z.literal("")),
  currency: z.string().default("NGN"),
  images: z.array(z.string().url()).max(8, "Up to 8 images"),
  isPublished: z.boolean().default(true),
  quantity: z.coerce.number().int().min(0).default(0),
  sku: z.string().max(64).optional().or(z.literal("")),
  barcode: z.string().max(64).optional().or(z.literal("")),
  digitalFileUrl: z.string().url().optional().or(z.literal("")),
  rentalPeriodUnit: z.enum(["day", "week", "month"]).optional(),
  // Free-form, niche-specific fields (tags, featured/taxable/special-request
  // toggles, and any custom key/value pairs the merchant adds) stored on
  // Product.attributes. Kept as a loose record here rather than named
  // columns so this form -- and this schema -- stay usable for every niche
  // without a migration per vertical.
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
