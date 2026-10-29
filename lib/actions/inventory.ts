"use server";

import { canonicalizeBusinessType } from "@/lib/business-identity";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { roundMoney } from "@/lib/utils/pricing";
import type { ActionResult } from "@/types/actions";
import type { Store, Business, StockMovementType } from "@prisma/client";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { reconcileStockLedger, type StockLedgerReconciliation } from "@/lib/inventory-reconciliation";
import { consumeFifoStockTx, consumeFefoStockTx, createFifoBatchTx } from "@/lib/inventory-fifo";
import { getFnbRotationMode } from "@/lib/fnb-settings";

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

// "products" permission — see product.ts's assertStoreAccess for why this
// delegates to assertStorePermission instead of the old owner-only check.
async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const result = await assertStorePermission(slug, "products");
  if (!result.success) return result;
  return { success: true, store: result.store };
}

// --- Reads -------------------------------------------------------------

export type InventoryOverviewItem = {
  /**
   * Row id. For simple products this is the InventoryItem id; for variant
   * rows it is the ProductVariant id (check `stockType` before calling any
   * action that takes an InventoryItem id).
   */
  inventoryItemId: string;
  stockType: "PRODUCT" | "VARIANT";
  variantId: string | null;
  variantLabel: string | null;
  productId: string;
  productName: string;
  productImage: string | null;
  isPublished: boolean;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  lowStockThreshold: number;
  costPrice: number | null;
  sellingPrice: number;
  currency: string;
  profitPerUnit: number | null;
  marginPercent: number | null;
  status: "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";
};

/**
 * One row per sellable stock unit: simple (non-variant) products via their
 * InventoryItem, and each active ProductVariant for variant-enabled
 * products. A variant-enabled product's own InventoryItem is a stale
 * leftover (stock lives on its variants), so it is excluded -- counting it
 * would double-count or show phantom stock. costPrice is optional per row,
 * so profit/margin are null (shown as "—") until the merchant fills it in
 * -- never silently assumed as zero, which would show a misleadingly
 * perfect 100% margin.
 */
export async function getInventoryOverview(slug: string): Promise<InventoryOverviewItem[]> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  const [items, variants] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { storeId: access.store.id, product: { hasVariants: false } },
      include: { product: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.productVariant.findMany({
      where: { storeId: access.store.id, isActive: true, product: { hasVariants: true } },
      include: { product: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const build = (o: {
    id: string; stockType: "PRODUCT" | "VARIANT"; variantId: string | null; variantLabel: string | null;
    product: { id: string; name: string; images: string[]; isPublished: boolean; currency: string };
    sku: string | null; barcode: string | null; quantity: number; lowStockThreshold: number;
    cost: unknown; price: number;
  }): InventoryOverviewItem => {
    const costPrice = o.cost != null ? Number(o.cost) : null;
    const profitPerUnit = costPrice != null ? roundMoney(o.price - costPrice) : null;
    const marginPercent = costPrice != null && o.price > 0 ? roundMoney((profitPerUnit! / o.price) * 100) : null;
    return {
      inventoryItemId: o.id,
      stockType: o.stockType,
      variantId: o.variantId,
      variantLabel: o.variantLabel,
      productId: o.product.id,
      productName: o.product.name,
      productImage: o.product.images[0] ?? null,
      isPublished: o.product.isPublished,
      sku: o.sku,
      barcode: o.barcode,
      quantity: o.quantity,
      lowStockThreshold: o.lowStockThreshold,
      costPrice,
      sellingPrice: o.price,
      currency: o.product.currency,
      profitPerUnit,
      marginPercent,
      status: o.quantity === 0 ? "OUT_OF_STOCK" : o.quantity <= o.lowStockThreshold ? "LOW_STOCK" : "IN_STOCK",
    };
  };

  const rows = [
    ...items.map((i) => build({
      id: i.id, stockType: "PRODUCT", variantId: null, variantLabel: null, product: i.product,
      sku: i.sku, barcode: i.barcode, quantity: i.quantity, lowStockThreshold: i.lowStockThreshold,
      cost: i.costPrice, price: Number(i.product.price),
    })),
    ...variants.map((v) => build({
      id: v.id, stockType: "VARIANT", variantId: v.id, variantLabel: v.label, product: v.product,
      sku: v.sku, barcode: v.barcode, quantity: v.quantity, lowStockThreshold: v.lowStockThreshold,
      // A null variant price means "inherit the parent product's price".
      cost: v.costPrice, price: Number(v.price ?? v.product.price),
    })),
  ];
  return rows;
}

/** Store-wide profit summary bar for the top of the inventory page. */
export async function getInventoryProfitSummary(slug: string) {
  const items = await getInventoryOverview(slug);
  const withCost = items.filter((i) => i.costPrice != null);

  const totalCostValue = roundMoney(withCost.reduce((sum, i) => sum + i.costPrice! * i.quantity, 0));
  const totalRetailValue = roundMoney(withCost.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0));
  const totalPotentialProfit = roundMoney(totalRetailValue - totalCostValue);
  const blendedMargin = totalRetailValue > 0 ? roundMoney((totalPotentialProfit / totalRetailValue) * 100) : null;

  return {
    trackedWithCost: withCost.length,
    trackedTotal: items.length,
    totalCostValue,
    totalRetailValue,
    totalPotentialProfit,
    blendedMargin,
    lowStockCount: items.filter((i) => i.status === "LOW_STOCK").length,
    outOfStockCount: items.filter((i) => i.status === "OUT_OF_STOCK").length,
  };
}

export async function getInventoryItem(slug: string, inventoryItemId: string): Promise<InventoryOverviewItem | null> {
  const items = await getInventoryOverview(slug);
  return items.find((i) => i.inventoryItemId === inventoryItemId) ?? null;
}

export async function listStockHistory(slug: string, inventoryItemId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.stockMovement.findMany({
    where: { inventoryItemId, storeId: access.store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// --- Writes --------------------------------------------------------------

/**
 * Sends a merchant a one-time low-stock heads-up. Fired from adjustStock
 * only on the movement that actually crosses the threshold (quantityAfter
 * <= threshold, previous quantity was above it) -- never on every
 * already-low sale, which would spam the merchant on every unit sold.
 */
async function notifyLowStock(store: Store & { business: Business }, productName: string, quantity: number) {
  const email = store.business.email;
  if (!email) return;
  await sendOrderNotificationEmail(
    email,
    `Low stock: ${productName}`,
    `${productName} is down to ${quantity} unit${quantity === 1 ? "" : "s"} in ${store.name}. Restock soon to avoid running out.`
  );
}

/**
 * Records a stock movement and applies it atomically, then runs the
 * out-of-stock/low-stock automation off the resulting quantity. This is the
 * single write path for quantity changes -- restocks, manual corrections,
 * and (eventually) order fulfillment should all go through this so the
 * history ledger stays complete and automation never gets bypassed.
 */
export async function adjustStock(
  slug: string,
  inventoryItemId: string,
  delta: number,
  type: StockMovementType,
  note?: string
): Promise<ActionResult<{ quantity: number }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  if (!Number.isInteger(delta) || delta === 0) return { success: false, error: "Stock change must be a non-zero whole number." };

  let result: { quantity: number; crossedIntoLowStock: boolean; justRanOut: boolean } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findFirst({
          where: { id: inventoryItemId, storeId: access.store.id },
          include: { product: true },
        });
        if (!item) throw new Error("Inventory item not found.");

        const nextQuantity = item.quantity + delta;
        if (nextQuantity < 0) throw new Error("That would take stock below zero.");

        const wasAboveThreshold = item.quantity > item.lowStockThreshold;
        const crossedIntoLowStock = wasAboveThreshold && nextQuantity <= item.lowStockThreshold && nextQuantity > 0;
        const justRanOut = item.quantity > 0 && nextQuantity === 0;
        const justRestocked = item.quantity === 0 && nextQuantity > 0;

        await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: {
            quantity: nextQuantity,
            autoUnpublished: justRanOut ? true : justRestocked ? false : item.autoUnpublished,
          },
        });
        const movement = await tx.stockMovement.create({
          data: {
            inventoryItemId,
            storeId: access.store.id,
            type,
            quantityChange: delta,
            quantityAfter: nextQuantity,
            note: note || null,
          },
        });
        if (delta > 0) {
          await createFifoBatchTx(tx, {
            inventoryItemId,
            storeId: access.store.id,
            quantity: delta,
            unitCost: item.costPrice == null ? null : Number(item.costPrice),
            sourceNote: note || type,
          });
        } else {
          const canonicalType = canonicalizeBusinessType(access.store.businessType);
          const isFoodBusiness = canonicalType === "Restaurant" || canonicalType === "Food & Groceries";
          const consume = isFoodBusiness && getFnbRotationMode(access.store.enabledModules) === "FEFO" ? consumeFefoStockTx : consumeFifoStockTx;
          await consume(tx, {
            inventoryItemId,
            storeId: access.store.id,
            quantity: Math.abs(delta),
            stockMovementId: movement.id,
          });
        }
        if (justRanOut) {
          await tx.product.update({ where: { id: item.productId }, data: { isPublished: false } });
        } else if (justRestocked && item.autoUnpublished) {
          await tx.product.update({ where: { id: item.productId }, data: { isPublished: true } });
        }

        return { quantity: nextQuantity, crossedIntoLowStock, justRanOut };
      }, { isolationLevel: "Serializable", timeout: 15000 });
      break;
    } catch (err: any) {
      if (err?.message === "Inventory item not found." || err?.message === "That would take stock below zero.") {
        return { success: false, error: err.message };
      }
      if (err?.code === "P2034" && attempt < 2) continue;
      return { success: false, error: "Couldn't update stock safely. Please try again." };
    }
  }

  if (!result) return { success: false, error: "Couldn't update stock safely. Please try again." };
  if (result.crossedIntoLowStock || result.justRanOut) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, storeId: access.store.id }, include: { product: true } });
    if (item) await notifyLowStock(access.store, item.product.name, result.quantity);
  }

  revalidatePath(`/store/${slug}/admin/inventory`);
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { quantity: result.quantity } };
}

export async function updateCostPrice(slug: string, inventoryItemId: string, costPrice: number | null): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (costPrice != null && costPrice < 0) return { success: false, error: "Cost price can't be negative." };

  const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, storeId: access.store.id } });
  if (!item) return { success: false, error: "Inventory item not found." };

  await prisma.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { costPrice: costPrice != null ? roundMoney(costPrice) : null },
  });

  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function updateLowStockThreshold(slug: string, inventoryItemId: string, threshold: number): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (threshold < 0) return { success: false, error: "Threshold can't be negative." };

  const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, storeId: access.store.id } });
  if (!item) return { success: false, error: "Inventory item not found." };

  await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { lowStockThreshold: threshold } });

  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function updateSku(slug: string, inventoryItemId: string, sku: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, storeId: access.store.id } });
  if (!item) return { success: false, error: "Inventory item not found." };

  await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { sku: sku.trim() || null } });

  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function updateBarcode(slug: string, inventoryItemId: string, barcode: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, storeId: access.store.id } });
  if (!item) return { success: false, error: "Inventory item not found." };

  const trimmed = barcode.trim();
  if (trimmed) {
    const clash = await prisma.inventoryItem.findFirst({
      where: { storeId: access.store.id, barcode: trimmed, NOT: { id: inventoryItemId } },
    });
    if (clash) return { success: false, error: "That barcode is already in use." };
  }

  await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { barcode: trimmed || null } });

  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

/**
 * Generates a scannable 12-digit numeric barcode (see generateVariantBarcode
 * in lib/actions/variant.ts for the variant equivalent -- kept as an
 * internal receiving code, not a registered GS1/UPC barcode).
 */
export async function generateBarcode(slug: string, inventoryItemId: string): Promise<ActionResult<{ barcode: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const item = await prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, storeId: access.store.id } });
  if (!item) return { success: false, error: "Inventory item not found." };

  let barcode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
    const collision = await prisma.inventoryItem.findFirst({ where: { storeId: access.store.id, barcode: candidate } });
    if (!collision) {
      barcode = candidate;
      break;
    }
  }
  if (!barcode) return { success: false, error: "Couldn't generate a unique barcode, try again." };

  await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { barcode } });

  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: { barcode } };
}

/**
 * Generates a readable, store-unique SKU from the store slug + product name
 * (e.g. "ACME-BLUEMUG-4F2A") and saves it directly -- merchants can still
 * overwrite it via updateSku if they have their own scheme. Retries on the
 * rare collision since the random suffix keeps it short rather than fully
 * collision-proof.
 */
export async function generateSku(slug: string, inventoryItemId: string): Promise<ActionResult<{ sku: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, storeId: access.store.id },
    include: { product: true },
  });
  if (!item) return { success: false, error: "Inventory item not found." };

  const storePrefix = access.store.slug.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const namePrefix = item.product.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

  let sku = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `${storePrefix}-${namePrefix}-${suffix}`;
    const collision = await prisma.inventoryItem.findFirst({ where: { storeId: access.store.id, sku: candidate } });
    if (!collision) {
      sku = candidate;
      break;
    }
  }
  if (!sku) return { success: false, error: "Couldn't generate a unique SKU, try again." };

  await prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { sku } });

  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: { sku } };
}

// --- Ledger reconciliation ----------------------------------------------


export type InventoryReconciliationRow = StockLedgerReconciliation & {
  stockType: "PRODUCT" | "VARIANT";
  stockId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string | null;
};

/**
 * Read-only audit of the stock ledger. It deliberately never repairs a
 * quantity automatically: a discrepancy needs a merchant/staff decision and
 * should be resolved with an explicit correction movement.
 */
export async function getInventoryReconciliation(slug: string): Promise<InventoryReconciliationRow[]> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  const [items, variants] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { storeId: access.store.id, product: { hasVariants: false } },
      select: {
        id: true, productId: true, quantity: true, sku: true,
        product: { select: { name: true } },
        movements: { select: { id: true, quantityChange: true, quantityAfter: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.productVariant.findMany({
      where: { storeId: access.store.id, isActive: true },
      select: {
        id: true, productId: true, quantity: true, sku: true, label: true,
        product: { select: { name: true } },
        movements: { select: { id: true, quantityChange: true, quantityAfter: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  const productRows = items.map((item) => ({
    ...reconcileStockLedger(item.quantity, item.movements),
    stockType: "PRODUCT" as const,
    stockId: item.id,
    productId: item.productId,
    productName: item.product.name,
    variantLabel: null,
    sku: item.sku,
  }));

  const variantRows = variants.map((variant) => ({
    ...reconcileStockLedger(variant.quantity, variant.movements),
    stockType: "VARIANT" as const,
    stockId: variant.id,
    productId: variant.productId,
    productName: variant.product.name,
    variantLabel: variant.label,
    sku: variant.sku,
  }));

  return [...productRows, ...variantRows];
}

/**
 * Reorder queue derived from real on-hand quantities; never mutates stock.
 * Covers simple products and active variants; variant-enabled parents are
 * excluded (their own InventoryItem is stale -- stock lives on the variants).
 */
export async function getInventoryReorderSuggestions(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];
  const [items, variants] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { storeId: access.store.id, product: { hasVariants: false } },
      include: { product: true },
    }),
    prisma.productVariant.findMany({
      where: { storeId: access.store.id, isActive: true, product: { hasVariants: true } },
      include: { product: true },
    }),
  ]);

  const rows = [
    ...items.map((i) => ({ stockId: i.id, stockType: "PRODUCT" as const, variantLabel: null as string | null, productId: i.productId, productName: i.product.name, quantity: i.quantity, threshold: i.lowStockThreshold, cost: i.costPrice })),
    ...variants.map((v) => ({ stockId: v.id, stockType: "VARIANT" as const, variantLabel: v.label as string | null, productId: v.productId, productName: v.product.name, quantity: v.quantity, threshold: v.lowStockThreshold, cost: v.costPrice })),
  ];

  return rows
    .filter((r) => r.quantity <= r.threshold)
    .sort((a, b) => a.quantity - b.quantity)
    .map((r) => {
      const suggestedQuantity = Math.max(r.threshold * 2 - r.quantity, 1);
      const costPrice = r.cost == null ? null : Number(r.cost);
      return {
        inventoryItemId: r.stockId,
        stockType: r.stockType,
        variantLabel: r.variantLabel,
        productId: r.productId,
        productName: r.productName,
        quantity: r.quantity,
        threshold: r.threshold,
        suggestedQuantity,
        costPrice,
        estimatedSpend: costPrice == null ? null : roundMoney(costPrice * suggestedQuantity),
      };
    });
}

export async function getFifoBatches(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];
  const now = new Date();
  const rows = await prisma.inventoryBatch.findMany({
    where: { storeId: access.store.id, quantityRemaining: { gt: 0 } },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    take: 500,
    select: {
      id: true, batchNumber: true, quantityReceived: true, quantityRemaining: true, unitCost: true, receivedAt: true, expiryDate: true, sourceNote: true,
      inventoryItem: { select: { product: { select: { id: true, name: true } } } },
      variant: { select: { id: true, label: true, product: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((row) => ({
    ...row,
    unitCost: row.unitCost == null ? null : Number(row.unitCost),
    value: row.unitCost == null ? null : roundMoney(Number(row.unitCost) * row.quantityRemaining),
    isExpired: row.expiryDate ? row.expiryDate < now : false,
    expiresSoon: row.expiryDate ? row.expiryDate >= now && row.expiryDate <= new Date(now.getTime() + 7 * 86400000) : false,
  }));
}


// --- Variant row edits (inventory table) --------------------------------
// The inventory table lists variant rows next to simple products; these are
// the ProductVariant equivalents of updateCostPrice/updateSku/updateBarcode
// (SKU/barcode generation lives in lib/actions/variant.ts).

export async function updateVariantCostPrice(slug: string, variantId: string, costPrice: number | null): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) return { success: false, error: "Cost price can't be negative." };

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  await prisma.productVariant.update({ where: { id: variantId }, data: { costPrice: costPrice != null ? roundMoney(costPrice) : null } });
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function updateVariantSku(slug: string, variantId: string, sku: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  const trimmed = sku.trim();
  if (trimmed) {
    const clash = await prisma.productVariant.findFirst({ where: { storeId: access.store.id, sku: trimmed, NOT: { id: variantId } } });
    if (clash) return { success: false, error: "That SKU is already in use." };
  }
  await prisma.productVariant.update({ where: { id: variantId }, data: { sku: trimmed || null } });
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function updateVariantBarcode(slug: string, variantId: string, barcode: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  const trimmed = barcode.trim();
  if (trimmed) {
    const clash = await prisma.productVariant.findFirst({ where: { storeId: access.store.id, barcode: trimmed, NOT: { id: variantId } } });
    if (clash) return { success: false, error: "That barcode is already in use." };
  }
  await prisma.productVariant.update({ where: { id: variantId }, data: { barcode: trimmed || null } });
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}
