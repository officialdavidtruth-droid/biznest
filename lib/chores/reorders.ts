/**
 * Auto-drafted supplier reorders. Turns low-stock items into DRAFT purchase
 * orders grouped by supplier. It never sends anything: a draft is a
 * suggestion the owner reviews and sends, so no money or supplier commitment
 * happens without them.
 */
export type LowStockItem = {
  productId: string;
  name: string;
  quantity: number;
  threshold: number;
  /** What the merchant last paid per unit (InventoryItem.costPrice). */
  costPrice: number | null;
  suppliers: { supplierId: string; costPrice: number | null }[];
};

export type PlannedLine = { productId: string; description: string; quantityOrdered: number; unitCost: number };
export type PlannedOrder = { supplierId: string; lines: PlannedLine[] };
export type ReorderPlan = { orders: PlannedOrder[]; unassigned: { productId: string; name: string }[]; skippedAlreadyOrdered: number };

/** Same sizing rule the inventory page's reorder queue already uses. */
export const suggestedReorderQty = (i: { quantity: number; threshold: number }) => Math.max(i.threshold * 2 - i.quantity, 1);

export function planReorders(items: LowStockItem[], alreadyOnOpenPo: Set<string>): ReorderPlan {
  const bySupplier = new Map<string, PlannedLine[]>();
  const unassigned: ReorderPlan["unassigned"] = [];
  let skipped = 0;

  for (const item of items) {
    if (item.quantity > item.threshold) continue;
    if (alreadyOnOpenPo.has(item.productId)) { skipped++; continue; }
    if (item.suppliers.length === 0) { unassigned.push({ productId: item.productId, name: item.name }); continue; }

    // Cheapest known supplier wins; suppliers with no cost recorded rank last.
    const best = [...item.suppliers].sort((a, b) => (a.costPrice ?? Infinity) - (b.costPrice ?? Infinity))[0];
    const line: PlannedLine = {
      productId: item.productId,
      description: item.name,
      quantityOrdered: suggestedReorderQty(item),
      unitCost: best.costPrice ?? item.costPrice ?? 0,
    };
    bySupplier.set(best.supplierId, [...(bySupplier.get(best.supplierId) ?? []), line]);
  }

  return { orders: [...bySupplier].map(([supplierId, lines]) => ({ supplierId, lines })), unassigned, skippedAlreadyOrdered: skipped };
}
