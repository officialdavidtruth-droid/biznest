import "server-only";

import { logError } from "@/lib/observability/log";
import { consumeFifoStockTx, consumeFefoStockTx } from "@/lib/inventory-fifo";
import { getFnbRotationMode } from "@/lib/fnb-settings";
import type { Prisma } from "@prisma/client";

/**
 * Stock decrement for a paid order (runs inside the caller's transaction).
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

/**
 * Decrements stock for a paid order's line items.
 *
 * Physical products and variants only.
 * Services are not stock-tracked.
 */
export async function decrementStockForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  opts: { allowOversell?: boolean } = {}
) {
  const order = await tx.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
      store: { select: { businessType: true, enabledModules: true } },
    },
  });

  if (!order) return;
  const consumeStock = ["Restaurant", "Food & Groceries"].includes(order.store.businessType) && getFnbRotationMode(order.store.enabledModules) === "FEFO" ? consumeFefoStockTx : consumeFifoStockTx;

  // Payment callbacks/webhooks are intentionally replay-safe, but keep this
  // helper safe on its own as well. If this order already has an automatic
  // SALE movement, stock has already been consumed and must not be consumed
  // again. The check is inside the caller's transaction, so the enclosing
  // payment-state transition remains the primary race guard.
  const alreadyDecremented = await tx.stockMovement.findFirst({
    where: { orderId: order.id, type: "SALE" },
    select: { id: true },
  });
  if (alreadyDecremented) return;

  for (const item of order.items) {
    if (item.variantId) {
      const variant = await tx.productVariant.findFirst({ where: { id: item.variantId, storeId: order.storeId } });
      if (!variant) continue;
      // Payment paths pass allowOversell: the customer has already paid, so a
      // stock shortfall must never roll the PAID transition back. Consume what
      // exists and flag the shortfall for the merchant instead.
      if (item.quantity > variant.quantity && !opts.allowOversell) throw new Error(`Not enough stock for ${variant.label}.`);
      const consumed = Math.min(item.quantity, Math.max(variant.quantity, 0));
      if (consumed < item.quantity) void logError("PAYMENTS", "Oversold order: paid quantity exceeds stock", { orderId: order.id, variantId: variant.id, ordered: item.quantity, available: variant.quantity });
      const nextQuantity = variant.quantity - consumed;
      const justRanOut = variant.quantity > 0 && nextQuantity === 0;
      await tx.productVariant.update({ where: { id: variant.id }, data: { quantity: nextQuantity, autoUnpublished: justRanOut ? true : variant.autoUnpublished } });
      const movement = await tx.stockMovement.create({
        data: { variantId: variant.id, storeId: order.storeId, orderId: order.id, type: "SALE", quantityChange: -consumed, quantityAfter: nextQuantity, note: `Online sale (order ${order.id})${consumed < item.quantity ? ` — OVERSOLD by ${item.quantity - consumed}` : ""}` },
      });
      if (consumed > 0) await consumeStock(tx, { variantId: variant.id, storeId: order.storeId, quantity: consumed, stockMovementId: movement.id });
    } else if (item.productId) {
      const inventory = await tx.inventoryItem.findFirst({ where: { productId: item.productId, storeId: order.storeId } });
      if (!inventory) continue;
      if (item.quantity > inventory.quantity && !opts.allowOversell) throw new Error(`Not enough stock for ${item.productId}.`);
      const consumed = Math.min(item.quantity, Math.max(inventory.quantity, 0));
      if (consumed < item.quantity) void logError("PAYMENTS", "Oversold order: paid quantity exceeds stock", { orderId: order.id, productId: item.productId, ordered: item.quantity, available: inventory.quantity });
      const nextQuantity = inventory.quantity - consumed;
      const justRanOut = inventory.quantity > 0 && nextQuantity === 0;
      await tx.inventoryItem.update({ where: { id: inventory.id }, data: { quantity: nextQuantity, autoUnpublished: justRanOut ? true : inventory.autoUnpublished } });
      if (justRanOut) await tx.product.update({ where: { id: item.productId }, data: { isPublished: false } });
      const movement = await tx.stockMovement.create({
        data: { inventoryItemId: inventory.id, storeId: order.storeId, orderId: order.id, type: "SALE", quantityChange: -consumed, quantityAfter: nextQuantity, note: `Online sale (order ${order.id})${consumed < item.quantity ? ` — OVERSOLD by ${item.quantity - consumed}` : ""}` },
      });
      if (consumed > 0) await consumeStock(tx, { inventoryItemId: inventory.id, storeId: order.storeId, quantity: consumed, stockMovementId: movement.id });
    }
  }
}
