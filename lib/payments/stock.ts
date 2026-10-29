import "server-only";

import { consumeRecipeIngredientsTx } from "@/lib/fnb-recipe-stock";
import { getCanonicalBusinessType } from "@/lib/business-identity";
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


type StockRow = { quantity: number };
type StockAccessor = {
  read: () => Promise<StockRow | null>;
  /** Atomic guarded decrement: matches 0 rows if stock fell below `amount` since the read. */
  decrement: (amount: number) => Promise<number>;
};

/**
 * Takes up to `wanted` units from one stock row without a read-modify-write
 * race. The decrement is a single guarded UPDATE (`quantity >= consumed`), so
 * two paid orders settling at once for the same item can never overwrite each
 * other's decrement: whichever commits second matches 0 rows, re-reads the
 * fresh balance and retries with what is actually left.
 *
 * Returns the units taken and the balance afterwards (read inside the same
 * transaction, i.e. after our own row lock, so the ledger's running balance
 * stays consistent). With allowOversell the shortfall is not an error: the
 * customer has already paid, so we take what exists and let the caller log it.
 */
async function takeStockAtomically(
  stock: StockAccessor,
  wanted: number,
  opts: { allowOversell?: boolean; shortMessage: string }
): Promise<{ consumed: number; before: number; after: number } | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await stock.read();
    if (!row) return null;
    const available = Math.max(row.quantity, 0);
    if (wanted > available && !opts.allowOversell) throw new Error(opts.shortMessage);
    const consumed = Math.min(wanted, available);
    if (consumed <= 0) return { consumed: 0, before: row.quantity, after: row.quantity };
    const count = await stock.decrement(consumed);
    if (count === 1) {
      const fresh = await stock.read();
      return { consumed, before: available, after: fresh ? fresh.quantity : available - consumed };
    }
    // Lost the race to a concurrent decrement: loop and re-read.
  }
  throw new Error("Stock changed too quickly while settling the order. Please retry.");
}

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
      store: { select: { businessType: true, enabledModules: true, business: { select: { category: true } } } },
    },
  });

  if (!order) return;
  const consumeStock = ["Restaurant", "Food & Groceries"].includes(getCanonicalBusinessType({ businessCategory: order.store.business?.category, storeBusinessType: order.store.businessType })) && getFnbRotationMode(order.store.enabledModules) === "FEFO" ? consumeFefoStockTx : consumeFifoStockTx;

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

  // Lock rows in a stable order: two orders containing the same items in
  // opposite order would otherwise deadlock on each other's row locks.
  const orderedItems = [...order.items].sort((a, b) => (a.variantId ?? a.productId ?? "").localeCompare(b.variantId ?? b.productId ?? ""));

  for (const item of orderedItems) {
    // Dishes with a recipe consume their ingredients instead of their own
    // stock count. Paid orders (allowOversell) take what exists and log any
    // shortfall; otherwise a short ingredient aborts the transition.
    if (item.productId || item.variantId) {
      const dishProductId = item.productId ?? (await tx.productVariant.findFirst({ where: { id: item.variantId!, storeId: order.storeId }, select: { productId: true } }))?.productId;
      const dish = dishProductId ? await tx.product.findFirst({ where: { id: dishProductId, storeId: order.storeId }, select: { name: true, attributes: true } }) : null;
      if (dish) {
        const recipe = await consumeRecipeIngredientsTx(tx, { storeId: order.storeId, orderId: order.id, attributes: dish.attributes, portions: item.quantity, dishName: dish.name, source: "Online", strict: !opts.allowOversell, consume: consumeStock });
        if (recipe.shortfalls.length > 0) void logError("PAYMENTS", "Oversold order: recipe ingredient shortfall", { orderId: order.id, productId: dishProductId, shortfalls: recipe.shortfalls });
        if (recipe.handled) continue;
      }
    }
    if (item.variantId) {
      const variant = await tx.productVariant.findFirst({ where: { id: item.variantId, storeId: order.storeId } });
      if (!variant) continue;
      // Payment paths pass allowOversell: the customer has already paid, so a
      // stock shortfall must never roll the PAID transition back. Consume what
      // exists and flag the shortfall for the merchant instead.
      const taken = await takeStockAtomically(
        {
          read: () => tx.productVariant.findFirst({ where: { id: variant.id, storeId: order.storeId }, select: { quantity: true } }),
          decrement: async (amount) => (await tx.productVariant.updateMany({ where: { id: variant.id, storeId: order.storeId, quantity: { gte: amount } }, data: { quantity: { decrement: amount } } })).count,
        },
        item.quantity,
        { allowOversell: opts.allowOversell, shortMessage: `Not enough stock for ${variant.label}.` }
      );
      if (!taken) continue;
      const { consumed, before, after: nextQuantity } = taken;
      if (consumed < item.quantity) void logError("PAYMENTS", "Oversold order: paid quantity exceeds stock", { orderId: order.id, variantId: variant.id, ordered: item.quantity, available: before });
      const justRanOut = consumed > 0 && nextQuantity === 0;
      if (justRanOut) await tx.productVariant.update({ where: { id: variant.id }, data: { autoUnpublished: true } });
      const movement = await tx.stockMovement.create({
        data: { variantId: variant.id, storeId: order.storeId, orderId: order.id, type: "SALE", quantityChange: -consumed, quantityAfter: nextQuantity, note: `Online sale (order ${order.id})${consumed < item.quantity ? ` — OVERSOLD by ${item.quantity - consumed}` : ""}` },
      });
      if (consumed > 0) await consumeStock(tx, { variantId: variant.id, storeId: order.storeId, quantity: consumed, stockMovementId: movement.id });
    } else if (item.productId) {
      const inventory = await tx.inventoryItem.findFirst({ where: { productId: item.productId, storeId: order.storeId } });
      if (!inventory) continue;
      const taken = await takeStockAtomically(
        {
          read: () => tx.inventoryItem.findFirst({ where: { id: inventory.id, storeId: order.storeId }, select: { quantity: true } }),
          decrement: async (amount) => (await tx.inventoryItem.updateMany({ where: { id: inventory.id, storeId: order.storeId, quantity: { gte: amount } }, data: { quantity: { decrement: amount } } })).count,
        },
        item.quantity,
        { allowOversell: opts.allowOversell, shortMessage: `Not enough stock for ${item.productId}.` }
      );
      if (!taken) continue;
      const { consumed, before, after: nextQuantity } = taken;
      if (consumed < item.quantity) void logError("PAYMENTS", "Oversold order: paid quantity exceeds stock", { orderId: order.id, productId: item.productId, ordered: item.quantity, available: before });
      const justRanOut = consumed > 0 && nextQuantity === 0;
      if (justRanOut) {
        await tx.inventoryItem.update({ where: { id: inventory.id }, data: { autoUnpublished: true } });
        await tx.product.update({ where: { id: item.productId }, data: { isPublished: false } });
      }
      const movement = await tx.stockMovement.create({
        data: { inventoryItemId: inventory.id, storeId: order.storeId, orderId: order.id, type: "SALE", quantityChange: -consumed, quantityAfter: nextQuantity, note: `Online sale (order ${order.id})${consumed < item.quantity ? ` — OVERSOLD by ${item.quantity - consumed}` : ""}` },
      });
      if (consumed > 0) await consumeStock(tx, { inventoryItemId: inventory.id, storeId: order.storeId, quantity: consumed, stockMovementId: movement.id });
    }
  }
}
