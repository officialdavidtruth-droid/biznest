import type { Prisma } from "@prisma/client";

export type FifoStockTarget =
  | { inventoryItemId: string; variantId?: never }
  | { variantId: string; inventoryItemId?: never };

type Tx = Prisma.TransactionClient;

/**
 * Consumes stock from the oldest remaining FIFO batches first. The caller must
 * already hold a serializable transaction and must create the SALE/other
 * negative StockMovement before calling this helper so the consumption rows
 * can point at the immutable movement id.
 */
export async function consumeFifoStockTx(
  tx: Tx,
  args: FifoStockTarget & { storeId: string; quantity: number; stockMovementId: string }
) {
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) throw new Error("FIFO quantity must be a positive whole number.");

  const where = args.inventoryItemId
    ? { storeId: args.storeId, inventoryItemId: args.inventoryItemId }
    : { storeId: args.storeId, variantId: args.variantId! };

  let batches = await tx.inventoryBatch.findMany({
    where: { ...where, quantityRemaining: { gt: 0 } },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
  });

  const currentQuantity = args.inventoryItemId
    ? (await tx.inventoryItem.findFirst({ where: { id: args.inventoryItemId, storeId: args.storeId }, select: { quantity: true, costPrice: true } }))
    : (await tx.productVariant.findFirst({ where: { id: args.variantId!, storeId: args.storeId }, select: { quantity: true, costPrice: true } }));
  if (!currentQuantity) throw new Error("Stock item not found.");
  if (currentQuantity.quantity < args.quantity) throw new Error("Not enough stock.");

  // Existing merchants may have positive stock from before FIFO was enabled.
  // Represent that unbatched opening balance as the oldest possible lot so
  // FIFO remains deterministic without inventing historical purchases.
  const batchedQty = batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
  const legacyQty = currentQuantity.quantity - batchedQty;
  if (legacyQty > 0) {
    const opening = await tx.inventoryBatch.create({
      data: {
        storeId: args.storeId,
        inventoryItemId: args.inventoryItemId ?? null,
        variantId: args.variantId ?? null,
        batchNumber: "OPENING-BALANCE",
        quantityReceived: legacyQty,
        quantityRemaining: legacyQty,
        unitCost: currentQuantity.costPrice,
        receivedAt: new Date("1970-01-01T00:00:00.000Z"),
        sourceNote: "Opening balance created when FIFO was enabled",
      },
    });
    batches = [opening, ...batches];
  }

  let remaining = args.quantity;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantityRemaining);
    if (take <= 0) continue;

    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { quantityRemaining: { decrement: take } },
    });
    await tx.inventoryBatchConsumption.create({
      data: {
        inventoryBatchId: batch.id,
        stockMovementId: args.stockMovementId,
        quantity: take,
        unitCost: batch.unitCost,
      },
    });
    remaining -= take;
  }

  if (remaining > 0) throw new Error("FIFO stock allocation failed.");
}


/**
 * Consumes food/perishable stock using FEFO (First-Expired, First-Out).
 * Non-expired lots with the nearest expiry are consumed first; lots without
 * an expiry date are fallback stock. Expired lots are never silently sold.
 */
export async function consumeFefoStockTx(
  tx: Tx,
  args: FifoStockTarget & { storeId: string; quantity: number; stockMovementId: string; now?: Date }
) {
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) throw new Error("FEFO quantity must be a positive whole number.");
  const now = args.now ?? new Date();
  const where = args.inventoryItemId
    ? { storeId: args.storeId, inventoryItemId: args.inventoryItemId }
    : { storeId: args.storeId, variantId: args.variantId! };

  const currentQuantity = args.inventoryItemId
    ? await tx.inventoryItem.findFirst({ where: { id: args.inventoryItemId, storeId: args.storeId }, select: { quantity: true, costPrice: true } })
    : await tx.productVariant.findFirst({ where: { id: args.variantId!, storeId: args.storeId }, select: { quantity: true, costPrice: true } });
  if (!currentQuantity) throw new Error("Stock item not found.");
  if (currentQuantity.quantity < args.quantity) throw new Error("Not enough stock.");

  let batches = await tx.inventoryBatch.findMany({
    where: { ...where, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
  });

  // Existing stock created before batch tracking is represented as an opening
  // lot. It has no expiry because its historical expiry is unknown.
  const batchedQty = batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
  const legacyQty = currentQuantity.quantity - batchedQty;
  if (legacyQty > 0) {
    const opening = await tx.inventoryBatch.create({
      data: {
        storeId: args.storeId,
        inventoryItemId: args.inventoryItemId ?? null,
        variantId: args.variantId ?? null,
        batchNumber: "OPENING-BALANCE",
        quantityReceived: legacyQty,
        quantityRemaining: legacyQty,
        unitCost: currentQuantity.costPrice,
        receivedAt: new Date("1970-01-01T00:00:00.000Z"),
        sourceNote: "Opening balance created when FEFO was enabled",
      },
    });
    batches.push(opening);
  }

  const expired = batches.filter((b) => b.expiryDate && b.expiryDate <= now);
  const usable = batches.filter((b) => !b.expiryDate || b.expiryDate > now)
    .sort((a, b) => {
      if (a.expiryDate && b.expiryDate) return a.expiryDate.getTime() - b.expiryDate.getTime() || a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id);
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id);
    });

  let remaining = args.quantity;
  for (const batch of usable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantityRemaining);
    if (take <= 0) continue;
    await tx.inventoryBatch.update({ where: { id: batch.id }, data: { quantityRemaining: { decrement: take } } });
    await tx.inventoryBatchConsumption.create({ data: { inventoryBatchId: batch.id, stockMovementId: args.stockMovementId, quantity: take, unitCost: batch.unitCost } });
    remaining -= take;
  }

  if (remaining > 0) {
    if (expired.length) throw new Error("Not enough non-expired stock. Expired batches are blocked from sale.");
    throw new Error("FEFO stock allocation failed.");
  }
}

export async function createFifoBatchTx(
  tx: Tx,
  args: FifoStockTarget & {
    storeId: string;
    quantity: number;
    unitCost?: number | null;
    receivedAt?: Date;
    expiryDate?: Date | null;
    batchNumber?: string | null;
    purchaseOrderItemId?: string | null;
    sourceNote?: string | null;
  }
) {
  if (!Number.isInteger(args.quantity) || args.quantity <= 0) throw new Error("FIFO batch quantity must be a positive whole number.");
  return tx.inventoryBatch.create({
    data: {
      storeId: args.storeId,
      inventoryItemId: args.inventoryItemId ?? null,
      variantId: args.variantId ?? null,
      quantityReceived: args.quantity,
      quantityRemaining: args.quantity,
      unitCost: args.unitCost == null ? null : args.unitCost,
      receivedAt: args.receivedAt ?? new Date(),
      expiryDate: args.expiryDate ?? null,
      batchNumber: args.batchNumber?.trim() || null,
      purchaseOrderItemId: args.purchaseOrderItemId ?? null,
      sourceNote: args.sourceNote?.trim() || null,
    },
  });
}
