import { z } from "zod";

// A POS line references exactly one of productId/variantId/serviceId --
// enforced in lib/actions/pos.ts rather than here, since zod's refine
// messages are worse to surface per-line than a single flat error.
export const posSaleItemSchema = z.object({
  productId: z.string().cuid().optional(),
  variantId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  quantity: z.coerce.number().int().min(1),
});

export const posTenderTypes = ["Cash", "Card", "Transfer"] as const;

export const posSaleSchema = z.object({
  items: z.array(posSaleItemSchema).min(1, "Add at least one item to the sale."),
  tenderType: z.enum(posTenderTypes),
  customerName: z.string().trim().max(120).optional(),
  customerPhone: z.string().trim().max(30).optional(),
  customerEmail: z.string().trim().email().max(180).optional(),
  customerProfileId: z.string().cuid().optional(),
});

export type PosSaleInput = z.infer<typeof posSaleSchema>;
