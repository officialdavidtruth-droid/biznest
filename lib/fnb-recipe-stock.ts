import type { Prisma } from "@prisma/client";
import { extractFnbRecipe } from "@/lib/fnb-utils";
import type { consumeFifoStockTx } from "@/lib/inventory-fifo";

type Tx = Prisma.TransactionClient;
type ConsumeStock = typeof consumeFifoStockTx;

/** Suffix on the note of every recipe-ingredient SALE movement; refunds use it to find them. */
export const RECIPE_INGREDIENT_NOTE_MARKER = "recipe ingredient";

/** Thrown when a recipe sale cannot be covered by ingredient stock (strict mode). */
export class RecipeStockError extends Error {}

export type RecipeRequirement = { inventoryItemId: string; quantity: number };

/**
 * Pure maths: how much of each ingredient do `portions` sold portions need?
 *
 * A recipe lists ingredient quantities for `yieldQty` portions, so one portion
 * uses quantity / yieldQty. Stock is stored in whole units (the smallest unit
 * the merchant counts in: g, ml, pcs), so the total for the whole sale is
 * rounded UP once, not per portion, which keeps rounding error from piling up
 * on large orders. Repeated ingredients are merged into one requirement.
 *
 * Returns null when the product has no usable recipe.
 */
export function computeRecipeRequirements(attributes: unknown, portions: number): RecipeRequirement[] | null {
  const recipe = extractFnbRecipe(attributes);
  if (!recipe || recipe.ingredients.length === 0) return null;
  if (!Number.isFinite(portions) || portions <= 0) return [];
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  const totals = new Map<string, number>();
  for (const ingredient of recipe.ingredients) {
    totals.set(ingredient.inventoryItemId, (totals.get(ingredient.inventoryItemId) ?? 0) + (ingredient.quantity / yieldQty) * portions);
  }
  const out: RecipeRequirement[] = [];
  for (const [inventoryItemId, raw] of totals) {
    // Subtract a tiny epsilon so float noise (e.g. 0.1 * 3 = 0.30000000000000004) doesn't round up a whole unit.
    const quantity = Math.ceil(raw - 1e-9);
    if (quantity > 0) out.push({ inventoryItemId, quantity });
  }
  return out;
}

/**
 * Deducts a recipe's ingredients from stock for `portions` sold portions of a
 * dish, inside the caller's transaction. Each ingredient gets its own SALE
 * StockMovement tagged with the order (so replay guards and later reversals can
 * find it) and is consumed through the store's FIFO/FEFO rotation.
 *
 * Returns { handled: false } when the dish has no recipe, so the caller falls
 * back to its normal dish-level stock handling. When { handled: true }, the
 * caller must NOT also decrement the dish's own stock.
 *
 * strict: true  -> throw RecipeStockError if any ingredient is short (POS).
 * strict: false -> take what exists and report shortfalls (already-paid online
 *                  orders must never roll back over a stock shortfall).
 */
export async function consumeRecipeIngredientsTx(
  tx: Tx,
  args: {
    storeId: string;
    orderId: string;
    attributes: unknown;
    portions: number;
    dishName: string;
    source: "POS" | "Online";
    strict: boolean;
    consume: ConsumeStock;
  }
): Promise<{ handled: boolean; shortfalls: Array<{ inventoryItemId: string; short: number }> }> {
  const requirements = computeRecipeRequirements(args.attributes, args.portions);
  if (!requirements) return { handled: false, shortfalls: [] };

  const shortfalls: Array<{ inventoryItemId: string; short: number }> = [];
  for (const need of requirements) {
    const item = await tx.inventoryItem.findFirst({
      where: { id: need.inventoryItemId, storeId: args.storeId },
      select: { id: true, quantity: true, product: { select: { name: true } } },
    });
    // The ingredient was deleted after the recipe was saved. Skip it rather
    // than blocking every sale of the dish; the recipe screen can flag it.
    if (!item) continue;

    const available = Math.max(item.quantity, 0);
    if (available < need.quantity && args.strict) {
      throw new RecipeStockError(`Not enough ${item.product.name} to make ${args.dishName}.`);
    }
    const consumed = Math.min(need.quantity, available);
    if (consumed < need.quantity) shortfalls.push({ inventoryItemId: item.id, short: need.quantity - consumed });
    if (consumed <= 0) continue;

    // Guarded decrement: a concurrent sale can't push stock negative.
    const updated = await tx.inventoryItem.updateMany({
      where: { id: item.id, quantity: { gte: consumed } },
      data: { quantity: { decrement: consumed } },
    });
    if (updated.count === 0) {
      if (args.strict) throw new RecipeStockError(`Not enough ${item.product.name} to make ${args.dishName}.`);
      shortfalls.push({ inventoryItemId: item.id, short: consumed });
      continue;
    }
    const fresh = await tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id }, select: { quantity: true } });
    const movement = await tx.stockMovement.create({
      data: {
        inventoryItemId: item.id,
        storeId: args.storeId,
        orderId: args.orderId,
        type: "SALE",
        quantityChange: -consumed,
        quantityAfter: fresh.quantity,
        note: `${args.source} sale of ${args.dishName} x${args.portions} (order ${args.orderId}) — ${RECIPE_INGREDIENT_NOTE_MARKER}`,
      },
    });
    await args.consume(tx, { inventoryItemId: item.id, storeId: args.storeId, quantity: consumed, stockMovementId: movement.id });
  }
  return { handled: true, shortfalls };
}
