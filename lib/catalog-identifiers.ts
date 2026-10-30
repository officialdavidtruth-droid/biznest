import { prisma } from "@/lib/prisma";

export type IdentifierClash = { field: "sku" | "barcode" };

/**
 * SKUs and barcodes must be unique across everything sellable in a store, but
 * the database uniques are per table (InventoryItem and ProductVariant each
 * enforce their own). This checks both so a product can't reuse a variant's
 * code or vice versa. Callers pass trimmed values.
 */
export async function findIdentifierClash(
  storeId: string,
  ids: { sku?: string | null; barcode?: string | null },
  exclude: { productId?: string; variantId?: string } = {}
): Promise<IdentifierClash | null> {
  for (const field of ["barcode", "sku"] as const) {
    const value = ids[field];
    if (!value) continue;
    const [item, variant] = await Promise.all([
      prisma.inventoryItem.findFirst({
        where: { storeId, [field]: value, ...(exclude.productId ? { NOT: { productId: exclude.productId } } : {}) },
        select: { id: true },
      }),
      prisma.productVariant.findFirst({
        where: { storeId, [field]: value, ...(exclude.variantId ? { NOT: { id: exclude.variantId } } : {}) },
        select: { id: true },
      }),
    ]);
    if (item || variant) return { field };
  }
  return null;
}

export function clashResult(clash: IdentifierClash) {
  const label = clash.field === "sku" ? "SKU" : "barcode";
  return {
    success: false as const,
    error: `That ${label} is already in use.`,
    fieldErrors: { [clash.field]: ["Already in use"] } as Record<string, string[]>,
  };
}
