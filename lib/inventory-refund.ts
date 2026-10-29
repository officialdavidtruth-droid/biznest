import type { Prisma } from "@prisma/client";
import { createFifoBatchTx } from "@/lib/inventory-fifo";

type Tx = Prisma.TransactionClient;

/**
 * Restores inventory for a fully refunded order exactly once.
 *
 * Lives outside the "use server" refund actions on purpose: it takes a raw
 * transaction client, so exporting it from a server-action file would make it
 * a public endpoint. Import it only from refund code that already holds the
 * order/payment transaction.
 *
 * WHAT IS RESTORED: exactly what the sale actually took, read back from the
 * order's SALE stock movements, not what the order lines asked for. That
 * matters because
 *  - an oversold paid order consumed less than it ordered (restoring the
 *    ordered quantity would invent stock),
 *  - recipe dishes consume their ingredients, not their own count, and
 *  - a line whose stock was never tracked (or was already gone) took nothing.
 * Legacy movements written before StockMovement.orderId existed (and POS
 * sales, which carry the order only in the note) are matched by the
 * "(order <id>)" note.
 *
 * IDEMPOTENCY: the order-linked RETURN movement is the guard. A replay of the
 * refund (webhook retry, reconciliation) sees it and adds nothing.
 *
 * CONCURRENCY: stock is raised with an atomic `increment`, never an absolute
 * value computed from an earlier read, so a sale committing at the same time
 * is not overwritten.
 */
export async function restoreInventoryForRefund(tx: Tx, orderId: string, storeId: string): Promise<boolean> {
  const existingReturn = await tx.stockMovement.findFirst({
    where: { orderId, storeId, type: "RETURN" },
    select: { id: true },
  });
  if (existingReturn) return false;

  const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const sales = await tx.stockMovement.findMany({
    where: {
      storeId,
      type: "SALE",
      OR: [{ orderId }, { orderId: null, note: { contains: `(order ${orderId})` } }],
    },
    select: {
      inventoryItemId: true,
      variantId: true,
      quantityChange: true,
      batchConsumptions: { select: { quantity: true, unitCost: true } },
    },
  });

  // One entry per stock row: total units taken and the cost they were taken at.
  type Taken = { inventoryItemId: string | null; variantId: string | null; quantity: number; costValue: number; costUnits: number };
  const taken = new Map<string, Taken>();
  for (const sale of sales) {
    const units = -sale.quantityChange;
    if (units <= 0) continue;
    const key = sale.variantId ? `v:${sale.variantId}` : sale.inventoryItemId ? `i:${sale.inventoryItemId}` : null;
    if (!key) continue;
    const entry = taken.get(key) ?? { inventoryItemId: sale.inventoryItemId, variantId: sale.variantId, quantity: 0, costValue: 0, costUnits: 0 };
    entry.quantity += units;
    for (const c of sale.batchConsumptions) {
      if (c.unitCost == null) continue;
      entry.costValue += Number(c.unitCost) * c.quantity;
      entry.costUnits += c.quantity;
    }
    taken.set(key, entry);
  }

  // Stable order so concurrent refunds touching the same rows cannot deadlock.
  for (const key of [...taken.keys()].sort()) {
    const t = taken.get(key)!;
    const note = `Refund return (order ${orderId})`;
    // Cost of the returned lot: what the units were actually sold out of, else the row's current cost.
    const consumedCost = t.costUnits > 0 ? Math.round((t.costValue / t.costUnits) * 100) / 100 : null;

    if (t.variantId) {
      const variant = await tx.productVariant.findFirst({ where: { id: t.variantId, storeId }, select: { id: true, costPrice: true } });
      if (!variant) continue;
      const updated = await tx.productVariant.update({
        where: { id: variant.id },
        data: { quantity: { increment: t.quantity }, autoUnpublished: false },
        select: { quantity: true },
      });
      await tx.stockMovement.create({
        data: { variantId: variant.id, storeId, orderId, type: "RETURN", quantityChange: t.quantity, quantityAfter: updated.quantity, note },
      });
      await createFifoBatchTx(tx, {
        variantId: variant.id,
        storeId,
        quantity: t.quantity,
        unitCost: consumedCost ?? (variant.costPrice == null ? null : Number(variant.costPrice)),
        sourceNote: note,
      });
    } else if (t.inventoryItemId) {
      const inventory = await tx.inventoryItem.findFirst({
        where: { id: t.inventoryItemId, storeId },
        select: { id: true, productId: true, costPrice: true, autoUnpublished: true },
      });
      if (!inventory) continue;
      // Capture before clearing: the republish decision needs the original flag.
      const wasAutoUnpublished = inventory.autoUnpublished;
      const updated = await tx.inventoryItem.update({
        where: { id: inventory.id },
        data: { quantity: { increment: t.quantity }, ...(wasAutoUnpublished ? { autoUnpublished: false } : {}) },
        select: { quantity: true },
      });
      await tx.stockMovement.create({
        data: { inventoryItemId: inventory.id, storeId, orderId, type: "RETURN", quantityChange: t.quantity, quantityAfter: updated.quantity, note },
      });
      await createFifoBatchTx(tx, {
        inventoryItemId: inventory.id,
        storeId,
        quantity: t.quantity,
        unitCost: consumedCost ?? (inventory.costPrice == null ? null : Number(inventory.costPrice)),
        sourceNote: note,
      });
      // A refund restores stock but must not override a merchant's own
      // publication choice: only republish when this item was taken down
      // because it hit zero, and it was at zero before this return.
      const quantityBefore = updated.quantity - t.quantity;
      if (quantityBefore <= 0 && wasAutoUnpublished) {
        await tx.product.update({ where: { id: inventory.productId }, data: { isPublished: true } });
      }
    }
  }

  return true;
}
