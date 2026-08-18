"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { roundMoney } from "@/lib/utils/pricing";
import type { ActionResult } from "@/types/actions";
import type { Store, Business, StockMovementType } from "@prisma/client";
import { assertStorePermission } from "@/lib/access/assert-store-access";

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
  inventoryItemId: string;
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
 * One row per physical product with inventory tracking, plus the
 * cost/profit/margin math merchants actually want to see. costPrice is
 * optional per item, so profit/margin are null (shown as "—") until the
 * merchant fills it in -- never silently assumed as zero, which would show
 * a misleadingly perfect 100% margin.
 */
export async function getInventoryOverview(slug: string): Promise<InventoryOverviewItem[]> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  const items = await prisma.inventoryItem.findMany({
    where: { storeId: access.store.id },
    include: { product: true },
    orderBy: { updatedAt: "desc" },
  });

  return items.map((i) => {
    const sellingPrice = Number(i.product.price);
    const costPrice = i.costPrice != null ? Number(i.costPrice) : null;
    const profitPerUnit = costPrice != null ? roundMoney(sellingPrice - costPrice) : null;
    const marginPercent = costPrice != null && sellingPrice > 0 ? roundMoney((profitPerUnit! / sellingPrice) * 100) : null;

    return {
      inventoryItemId: i.id,
      productId: i.productId,
      productName: i.product.name,
      productImage: i.product.images[0] ?? null,
      isPublished: i.product.isPublished,
      sku: i.sku,
      barcode: i.barcode,
      quantity: i.quantity,
      lowStockThreshold: i.lowStockThreshold,
      costPrice,
      sellingPrice,
      currency: i.product.currency,
      profitPerUnit,
      marginPercent,
      status: i.quantity === 0 ? "OUT_OF_STOCK" : i.quantity <= i.lowStockThreshold ? "LOW_STOCK" : "IN_STOCK",
    };
  });
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

  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, storeId: access.store.id },
    include: { product: true },
  });
  if (!item) return { success: false, error: "Inventory item not found." };

  const nextQuantity = item.quantity + delta;
  if (nextQuantity < 0) return { success: false, error: "That would take stock below zero." };

  const wasAboveThreshold = item.quantity > item.lowStockThreshold;
  const crossedIntoLowStock = wasAboveThreshold && nextQuantity <= item.lowStockThreshold && nextQuantity > 0;
  const justRanOut = item.quantity > 0 && nextQuantity === 0;
  const justRestocked = item.quantity === 0 && nextQuantity > 0;

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        quantity: nextQuantity,
        // Auto-unpublish on hitting zero; auto-republish on restock only if
        // it was this automation (not the merchant) that took it down --
        // see the schema comment on autoUnpublished.
        autoUnpublished: justRanOut ? true : justRestocked ? false : item.autoUnpublished,
      },
    });
    await tx.stockMovement.create({
      data: {
        inventoryItemId,
        storeId: access.store.id,
        type,
        quantityChange: delta,
        quantityAfter: nextQuantity,
        note: note || null,
      },
    });
    if (justRanOut) {
      await tx.product.update({ where: { id: item.productId }, data: { isPublished: false } });
    } else if (justRestocked && item.autoUnpublished) {
      await tx.product.update({ where: { id: item.productId }, data: { isPublished: true } });
    }
  });

  if (crossedIntoLowStock || justRanOut) {
    await notifyLowStock(access.store, item.product.name, nextQuantity);
  }

  revalidatePath(`/store/${slug}/admin/inventory`);
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { quantity: nextQuantity } };
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
