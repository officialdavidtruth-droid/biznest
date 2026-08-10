import { z } from "zod";

export const variantOptionSchema = z.object({
  name: z.string().min(1).max(40),
  values: z.array(z.string().min(1).max(40)).min(1, "Add at least one value"),
});

export type VariantOption = z.infer<typeof variantOptionSchema>;

export const variantSchema = z.object({
  optionValues: z.record(z.string(), z.string()),
  sku: z.string().max(64).optional().or(z.literal("")),
  barcode: z.string().max(64).optional().or(z.literal("")),
  // Empty string means "inherit the product's price".
  price: z.coerce.number().positive().optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
});

export type VariantInput = z.infer<typeof variantSchema>;
