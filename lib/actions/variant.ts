"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { roundMoney } from "@/lib/utils/pricing";
import { variantOptionSchema, variantSchema, type VariantOption, type VariantInput } from "@/lib/validations/variant";
import type { ActionResult } from "@/types/actions";
import type { StockMovementType } from "@prisma/client";
import { z } from "zod";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// Variants are managed from the Products page ("products" permission in dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "products");
}

function comboLabel(combo: Record<string, string>): string {
  return Object.values(combo).join(" / ");
}

/** Cartesian product of each option's values, e.g. Size×Color -> every combo. */
function cartesian(options: VariantOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (combos, opt) =>
      combos.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))),
    [{}]
  );
}

// --- Reads -----------------------------------------------------------------

export async function listVariants(slug: string, productId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.productVariant.findMany({
    where: { productId, storeId: access.store.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function listStockHistoryForVariant(slug: string, variantId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.stockMovement.findMany({
    where: { variantId, storeId: access.store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * Scan-to-lookup for receiving: given a scanned barcode, finds the matching
 * variant or plain-product inventory item in this store. Checked in that
 * order since a variant-enabled product's barcodes live on ProductVariant,
 * not on its (unused) InventoryItem.
 */
export async function lookupByBarcode(slug: string, barcode: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false as const, error: access.error };

  const code = barcode.trim();
  if (!code) return { success: false as const, error: "Scan or enter a barcode." };

  const variant = await prisma.productVariant.findFirst({
    where: { storeId: access.store.id, barcode: code },
    include: { product: true },
  });
  if (variant) {
    return {
      success: true as const,
      kind: "variant" as const,
      variantId: variant.id,
      productId: variant.productId,
      productName: variant.product.name,
      label: variant.label,
      sku: variant.sku,
      quantity: variant.quantity,
    };
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { storeId: access.store.id, barcode: code },
    include: { product: true },
  });
  if (item) {
    return {
      success: true as const,
      kind: "product" as const,
      inventoryItemId: item.id,
      productId: item.productId,
      productName: item.product.name,
      label: item.product.name,
      sku: item.sku,
      quantity: item.quantity,
    };
  }

  return { success: false as const, error: "No product or variant matches that barcode." };
}

// --- Option matrix / variant creation --------------------------------------

/**
 * Sets (or updates) a product's variant option axes and syncs its variant
 * rows to match: creates any new combos, leaves existing ones (and their
 * stock/sku/barcode) untouched, and marks combos that no longer match the
 * option schema inactive rather than deleting them (an inactive variant may
 * still be referenced by past OrderItems).
 */
export async function setVariantOptions(
  slug: string,
  productId: string,
  options: VariantOption[]
): Promise<ActionResult<{ variantCount: number }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const parsed = z.array(variantOptionSchema).min(1, "Add at least one option").safeParse(options);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid options." };
  }

  const product = await prisma.product.findFirst({ where: { id: productId, storeId: access.store.id } });
  if (!product) return { success: false, error: "Product not found." };

  const combos = cartesian(parsed.data);
  const existing = await prisma.productVariant.findMany({ where: { productId } });
  const existingLabels = new Set(existing.map((v) => v.label));
  const validLabels = new Set(combos.map(comboLabel));

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { hasVariants: true, variantOptions: parsed.data },
    });

    for (const combo of combos) {
      const label = comboLabel(combo);
      if (existingLabels.has(label)) continue;
      await tx.productVariant.create({
        data: {
          productId,
          storeId: access.store.id,
          optionValues: combo,
          label,
        },
      });
    }

    // Combos that existed before but no longer match the option schema
    // (e.g. a value was removed) are deactivated, not deleted.
    const stale = existing.filter((v) => !validLabels.has(v.label) && v.isActive);
    for (const v of stale) {
      await tx.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
    }
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { variantCount: combos.length } };
}

// --- Per-variant writes ------------------------------------------------------

export async function updateVariant(slug: string, variantId: string, input: VariantInput): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  if (data.sku) {
    const clash = await prisma.productVariant.findFirst({
      where: { storeId: access.store.id, sku: data.sku, NOT: { id: variantId } },
    });
    if (clash) return { success: false, error: "That SKU is already in use.", fieldErrors: { sku: ["Already in use"] } };
  }
  if (data.barcode) {
    const clash = await prisma.productVariant.findFirst({
      where: { storeId: access.store.id, barcode: data.barcode, NOT: { id: variantId } },
    });
    if (clash) return { success: false, error: "That barcode is already in use.", fieldErrors: { barcode: ["Already in use"] } };
  }

  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      sku: data.sku || null,
      barcode: data.barcode || null,
      price: data.price === "" || data.price == null ? null : roundMoney(data.price),
      lowStockThreshold: data.lowStockThreshold,
      isActive: data.isActive,
    },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function deleteVariant(slug: string, variantId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  const usedInOrder = await prisma.orderItem.findFirst({ where: { variantId } });
  if (usedInOrder) {
    // Keep order history intact -- deactivate instead of hard-deleting.
    await prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
  } else {
    await prisma.productVariant.delete({ where: { id: variantId } });
  }

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: undefined };
}

/** Same ledgered write path as adjustStock, but against a ProductVariant. */
export async function adjustVariantStock(
  slug: string,
  variantId: string,
  delta: number,
  type: StockMovementType,
  note?: string
): Promise<ActionResult<{ quantity: number }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, storeId: access.store.id },
    include: { product: true },
  });
  if (!variant) return { success: false, error: "Variant not found." };

  const nextQuantity = variant.quantity + delta;
  if (nextQuantity < 0) return { success: false, error: "That would take stock below zero." };

  const justRanOut = variant.quantity > 0 && nextQuantity === 0;
  const justRestocked = variant.quantity === 0 && nextQuantity > 0;

  await prisma.$transaction(async (tx) => {
    await tx.productVariant.update({
      where: { id: variantId },
      data: {
        quantity: nextQuantity,
        autoUnpublished: justRanOut ? true : justRestocked ? false : variant.autoUnpublished,
        isActive: justRanOut ? variant.isActive : justRestocked ? true : variant.isActive,
      },
    });
    await tx.stockMovement.create({
      data: {
        variantId,
        storeId: access.store.id,
        type,
        quantityChange: delta,
        quantityAfter: nextQuantity,
        note: note || null,
      },
    });
  });

  revalidatePath(`/store/${slug}/admin/inventory`);
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { quantity: nextQuantity } };
}

/** Same readable-scheme SKU generator as generateSku, scoped to a variant. */
export async function generateVariantSku(slug: string, variantId: string): Promise<ActionResult<{ sku: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, storeId: access.store.id },
    include: { product: true },
  });
  if (!variant) return { success: false, error: "Variant not found." };

  const storePrefix = access.store.slug.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const namePrefix = variant.product.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const optPrefix = Object.values(variant.optionValues as unknown as Record<string, string>)
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();

  let sku = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `${storePrefix}-${namePrefix}-${optPrefix}-${suffix}`;
    const collision = await prisma.productVariant.findFirst({ where: { storeId: access.store.id, sku: candidate } });
    if (!collision) {
      sku = candidate;
      break;
    }
  }
  if (!sku) return { success: false, error: "Couldn't generate a unique SKU, try again." };

  await prisma.productVariant.update({ where: { id: variantId }, data: { sku } });
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { sku } };
}

/**
 * Generates a scannable barcode: a 12-digit numeric code (UPC-A length,
 * without computing a real check digit -- this is an internal receiving
 * code, not a registered GS1 barcode for retail resale).
 */
export async function generateVariantBarcode(slug: string, variantId: string): Promise<ActionResult<{ barcode: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  let barcode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
    const collision = await prisma.productVariant.findFirst({ where: { storeId: access.store.id, barcode: candidate } });
    if (!collision) {
      barcode = candidate;
      break;
    }
  }
  if (!barcode) return { success: false, error: "Couldn't generate a unique barcode, try again." };

  await prisma.productVariant.update({ where: { id: variantId }, data: { barcode } });
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { barcode } };
}
