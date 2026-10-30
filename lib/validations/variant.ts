import { z } from "zod";

// Keeps the cartesian product (one DB row per combination) bounded.
export const MAX_OPTIONS = 3;
export const MAX_VALUES_PER_OPTION = 30;
export const MAX_VARIANT_COMBINATIONS = 200;

export const variantOptionSchema = z.object({
  name: z.string().min(1).max(40),
  values: z.array(z.string().min(1).max(40)).min(1, "Add at least one value").max(MAX_VALUES_PER_OPTION, `Up to ${MAX_VALUES_PER_OPTION} values per option`),
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
