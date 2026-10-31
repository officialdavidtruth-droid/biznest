import type { Prisma } from "@prisma/client";
import { recordBatchLedgerForQuantityChangeTx } from "@/lib/inventory-fifo";

type Tx = Prisma.TransactionClient;

/**
 * Guard that makes the write fail (INVENTORY_CONFLICT) if the row moved since it was
 * read: either on the quantity itself, or on updatedAt (CSV rows carry the export-time
 * timestamp). Exactly one is given.
 */
export type StockGuard = { quantity: number } | { updatedAt: Date };

/**
 * The single write path for correcting a plain product's on-hand quantity from the
 * product editor, bulk edit and CSV import: a compare-and-set update, a CORRECTION
 * movement in the ledger, and the matching batch adjustment, all inside the caller's
 * transaction. Throws Error("INVENTORY_CONFLICT") if the guard no longer matches.
 *
 * Other inventory fields (sku, barcode, cost, threshold) can ride along in `extra` so
 * they're covered by the same guard. With no quantity change and no `extra`, nothing
 * is written at all (so updatedAt isn't bumped needlessly).
 */
export async function correctInventoryQuantityTx(
  tx: Tx,
  args: {
    storeId: string;
    inventoryItemId: string;
    currentQuantity: number;
    nextQuantity: number;
    guard: StockGuard;
    autoUnpublished: boolean;
    note: string;
    unitCost: number | null;
    extra?: Record<string, unknown>;
  }
): Promise<{ delta: number }> {
  const delta = args.nextQuantity - args.currentQuantity;
  if (delta === 0 && !args.extra) return { delta };

  const updated = await tx.inventoryItem.updateMany({
    where: { id: args.inventoryItemId, storeId: args.storeId, ...args.guard },
    data: { ...(args.extra ?? {}), quantity: args.nextQuantity, autoUnpublished: args.autoUnpublished },
  });
  if (updated.count !== 1) throw new Error("INVENTORY_CONFLICT");

  if (delta !== 0) {
    const movement = await tx.stockMovement.create({
      data: {
        inventoryItemId: args.inventoryItemId,
        storeId: args.storeId,
        type: "CORRECTION",
        quantityChange: delta,
        quantityAfter: args.nextQuantity,
        note: args.note,
      },
    });
    await recordBatchLedgerForQuantityChangeTx(tx, {
      inventoryItemId: args.inventoryItemId,
      storeId: args.storeId,
      delta,
      stockMovementId: movement.id,
      unitCost: args.unitCost,
      sourceNote: args.note,
    });
  }
  return { delta };
}
