"use server";

import { prisma } from "@/lib/prisma";
import { findIdentifierClash, clashResult } from "@/lib/catalog-identifiers";
import { cartesian, planVariantSync } from "@/lib/variant-combos";
import { auth } from "@/lib/auth";
import { logStoreActivity } from "@/lib/activity-log";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { consumeFifoStockTx, createFifoBatchTx } from "@/lib/inventory-fifo";
import { revalidatePath } from "next/cache";
import { roundMoney } from "@/lib/utils/pricing";
import { variantOptionSchema, variantSchema, MAX_OPTIONS, MAX_VARIANT_COMBINATIONS, type VariantOption, type VariantInput } from "@/lib/validations/variant";
import type { ActionResult } from "@/types/actions";
import { Prisma, type StockMovementType } from "@prisma/client";
import { z } from "zod";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// Variants are managed from the Products page ("products" permission in dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "products");
}

async function assertMenuEditor(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return a;
  // Anyone granted the "products" permission (including STAFF) may create, edit and delete products and variants.
  return a;
}

/** Audit-logs a variant change and (unless told not to) tells webhook subscribers the product changed. */
async function recordVariantChange(
  store: { id: string },
  action: string,
  target: string,
  metadata: Record<string, unknown>,
  opts: { webhook?: boolean } = {}
) {
  const session = await auth();
  await logStoreActivity({
    storeId: store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action,
    target,
    metadata,
  });
  if (opts.webhook === false) return;
  try {
    await emitWebhookEvent("PRODUCT_UPDATED", store.id, { productId: metadata.productId ?? null, variantId: metadata.variantId ?? null, change: action });
  } catch {
    // A dead subscriber must never fail the merchant's action.
  }
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
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };

  const parsed = z.array(variantOptionSchema).min(1, "Add at least one option").safeParse(options);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid options." };
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
    include: { inventory: { select: { quantity: true } } },
  });
  if (!product) return { success: false, error: "Product not found." };

  if (parsed.data.length > MAX_OPTIONS) {
    return { success: false, error: `Use at most ${MAX_OPTIONS} options (for example Size, Color, Material).` };
  }

  // Turning variants on makes per-variant stock the only sellable stock; the
  // product's own stock would silently stop counting. Require it to be
  // cleared first (a ledgered correction from the product edit page) so no
  // stock disappears without a record.
  if (!product.hasVariants && (product.inventory?.quantity ?? 0) > 0) {
    return {
      success: false,
      error: `This product has ${product.inventory!.quantity} in stock. Set its stock to 0 on the product page first, then add variants and enter stock for each one.`,
    };
  }

  // De-duplicate values within each axis so a repeated value can't create a
  // duplicate combination.
  const cleaned: VariantOption[] = parsed.data.map((o) => ({
    name: o.name.trim(),
    values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))],
  }));
  if (cleaned.some((o) => o.values.length === 0)) return { success: false, error: "Each option needs at least one value." };
  if (new Set(cleaned.map((o) => o.name.toLowerCase())).size !== cleaned.length) {
    return { success: false, error: "Option names must be unique." };
  }

  const combos = cartesian(cleaned);
  if (combos.length > MAX_VARIANT_COMBINATIONS) {
    return { success: false, error: `That makes ${combos.length} variants. The limit is ${MAX_VARIANT_COMBINATIONS}; remove some option values.` };
  }
  const existing = await prisma.productVariant.findMany({ where: { productId } });
  const plan = planVariantSync(
    existing.map((v) => ({ id: v.id, label: v.label, optionValues: v.optionValues as unknown as Record<string, string>, isActive: v.isActive })),
    Array.isArray(product.variantOptions) ? (product.variantOptions as unknown as VariantOption[]) : null,
    cleaned
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
  await prisma.$transaction(async (tx) => {
    if (!product.hasVariants) {
      // Re-checked inside the transaction so a sale or restock can't slip in
      // between the check above and the switch to per-variant stock.
      const inv = await tx.inventoryItem.findUnique({ where: { productId }, select: { quantity: true } });
      if ((inv?.quantity ?? 0) > 0) throw new Error(`HAS_STOCK:${inv!.quantity}`);
    }
    await tx.product.update({
      where: { id: productId },
      data: { hasVariants: true, variantOptions: cleaned },
    });
    if (plan.toCreate.length) {
      await tx.productVariant.createMany({
        data: plan.toCreate.map((c) => ({ productId, storeId: access.store.id, optionValues: c.optionValues, label: c.label })),
      });
    }
    for (const u of plan.toUpdate) {
      await tx.productVariant.update({
        where: { id: u.id },
        data: { ...(u.reactivate ? { isActive: true } : {}), label: u.label, optionValues: u.optionValues },
      });
    }
    if (plan.toDeactivate.length) {
      await tx.productVariant.updateMany({ where: { id: { in: plan.toDeactivate } }, data: { isActive: false } });
    }
  }, { timeout: 30000, isolationLevel: "Serializable" });
      break;
    } catch (err: any) {
      if (typeof err?.message === "string" && err.message.startsWith("HAS_STOCK:")) {
        return { success: false, error: `This product has ${err.message.slice("HAS_STOCK:".length)} in stock. Set its stock to 0 on the product page first, then add variants and enter stock for each one.` };
      }
      if (err?.code === "P2034" && attempt < 2) continue;
      return { success: false, error: "Couldn't update the options safely. Please try again." };
    }
  }

  await recordVariantChange(access.store, "variant.options_updated", product.name, { productId, variantCount: combos.length, created: plan.toCreate.length, deactivated: plan.toDeactivate.length });
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { variantCount: combos.length } };
}

// --- Per-variant writes ------------------------------------------------------

export async function updateVariant(slug: string, variantId: string, input: VariantInput): Promise<ActionResult> {
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };

  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  const sku = data.sku?.trim() || null;
  const barcode = data.barcode?.trim() || null;
  // Checks other variants AND plain-product inventory (excluding this variant
  // and its own product's legacy parent item, so a converted product's SKU can move onto a variant).
  const clash = await findIdentifierClash(access.store.id, { sku, barcode }, { variantId, productId: variant.productId });
  if (clash) return clashResult(clash);

  try {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        sku,
        barcode,
        price: data.price === "" || data.price == null ? null : roundMoney(data.price),
        lowStockThreshold: data.lowStockThreshold,
        isActive: data.isActive,
        // A merchant toggling availability is a deliberate choice: clear the
        // automation flag so a later restock can't flip it back.
        ...(data.isActive !== variant.isActive ? { autoUnpublished: false } : {}),
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") return clashResult({ field: String(err?.meta?.target ?? "").includes("barcode") ? "barcode" : "sku" });
    throw err;
  }

  await recordVariantChange(access.store, "variant.updated", variant.label, {
    productId: variant.productId,
    variantId,
    ...(data.isActive !== variant.isActive ? { isActive: { from: variant.isActive, to: data.isActive } } : {}),
    ...(Number(variant.price ?? NaN) !== (data.price === "" || data.price == null ? NaN : roundMoney(data.price)) ? { price: { from: variant.price == null ? null : Number(variant.price), to: data.price === "" || data.price == null ? null : roundMoney(data.price) } } : {}),
  });
  revalidatePath(`/store/${slug}/admin/products`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: undefined };
}

export async function deleteVariant(slug: string, variantId: string): Promise<ActionResult> {
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  const usedInOrder = await prisma.orderItem.findFirst({ where: { variantId } });
  if (usedInOrder) {
    // Keep order history intact -- deactivate instead of hard-deleting.
    await prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.delete({ where: { id: variantId } });
      // Deleting the last variant must not leave the product flagged as
      // variant-enabled with nothing to sell. Return it to plain-product mode
      // with a zero-stock inventory row so it stays out of stock until the
      // merchant sets a quantity.
      const remaining = await tx.productVariant.count({ where: { productId: variant.productId } });
      if (remaining === 0) {
        await tx.product.update({ where: { id: variant.productId }, data: { hasVariants: false, variantOptions: Prisma.DbNull } });
        await tx.inventoryItem.upsert({
          where: { productId: variant.productId },
          create: { productId: variant.productId, storeId: access.store.id, quantity: 0 },
          update: {},
        });
      }
    }, { isolationLevel: "Serializable", timeout: 15000 });
  }
  await recordVariantChange(access.store, usedInOrder ? "variant.deactivated" : "variant.deleted", variant.label, { productId: variant.productId, variantId });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: undefined };
}

const MANUAL_MOVEMENT_TYPES = new Set<StockMovementType>(["RESTOCK", "RETURN", "MANUAL_ADJUSTMENT", "CORRECTION"]);

/** Same ledgered write path as adjustStock, but against a ProductVariant. */
export async function adjustVariantStock(
  slug: string,
  variantId: string,
  delta: number,
  type: StockMovementType,
  note?: string
): Promise<ActionResult<{ quantity: number }>> {
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };
  if (!Number.isInteger(delta) || delta === 0) return { success: false, error: "Stock change must be a non-zero whole number." };
  // Manual adjustments can only use manual movement types. SALE is reserved for
  // order automation; sign must match the meaning of the type.
  if (!MANUAL_MOVEMENT_TYPES.has(type)) return { success: false, error: "That isn't a valid stock adjustment type." };
  if ((type === "RESTOCK" || type === "RETURN") && delta < 0) return { success: false, error: `A ${type.toLowerCase()} must add stock.` };
  note = note?.trim().slice(0, 500) || undefined;

  let quantity: number | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      quantity = await prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id }, include: { product: true } });
        if (!variant) throw new Error("Variant not found.");
        const nextQuantity = variant.quantity + delta;
        if (nextQuantity < 0) throw new Error("That would take stock below zero.");
        const justRanOut = variant.quantity > 0 && nextQuantity === 0;
        const justRestocked = variant.quantity === 0 && nextQuantity > 0;

        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            quantity: nextQuantity,
            autoUnpublished: justRanOut ? true : justRestocked ? false : variant.autoUnpublished,
            // Only bring a variant back if the out-of-stock automation took it down;
            // never override a merchant's deliberate deactivation.
            isActive: justRestocked && variant.autoUnpublished ? true : variant.isActive,
          },
        });
        const movement = await tx.stockMovement.create({
          data: { variantId, storeId: access.store.id, type, quantityChange: delta, quantityAfter: nextQuantity, note: note || null },
        });
        if (delta > 0) {
          await createFifoBatchTx(tx, { variantId, storeId: access.store.id, quantity: delta, unitCost: variant.costPrice == null ? null : Number(variant.costPrice), sourceNote: note || type });
        } else {
          await consumeFifoStockTx(tx, { variantId, storeId: access.store.id, quantity: Math.abs(delta), stockMovementId: movement.id });
        }
        return nextQuantity;
      }, { isolationLevel: "Serializable", timeout: 15000 });
      break;
    } catch (err: any) {
      if (err?.message === "Variant not found." || err?.message === "That would take stock below zero.") return { success: false, error: err.message };
      if (err?.code === "P2034" && attempt < 2) continue;
      return { success: false, error: "Couldn't update variant stock safely. Please try again." };
    }
  }
  if (quantity == null) return { success: false, error: "Couldn't update variant stock safely. Please try again." };
  await recordVariantChange(access.store, "inventory.stock_adjusted", variantId, { variantId, type, delta, note: note?.slice(0, 200) ?? null, newQuantity: quantity }, { webhook: false });
  revalidatePath(`/store/${slug}/admin/inventory`);
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { quantity } };
}

/** Same readable-scheme SKU generator as generateSku, scoped to a variant. */
export async function generateVariantSku(slug: string, variantId: string): Promise<ActionResult<{ sku: string }>> {
  const access = await assertMenuEditor(slug);
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
    const collision = await findIdentifierClash(access.store.id, { sku: candidate });
    if (!collision) {
      sku = candidate;
      break;
    }
  }
  if (!sku) return { success: false, error: "Couldn't generate a unique SKU, try again." };

  try {
    await prisma.productVariant.update({ where: { id: variantId }, data: { sku } });
  } catch (err: any) {
    if (err?.code === "P2002") return { success: false, error: "That SKU was just taken. Try again." };
    throw err;
  }
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { sku } };
}

/**
 * Generates a scannable barcode: a 12-digit numeric code (UPC-A length,
 * without computing a real check digit -- this is an internal receiving
 * code, not a registered GS1 barcode for retail resale).
 */
export async function generateVariantBarcode(slug: string, variantId: string): Promise<ActionResult<{ barcode: string }>> {
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };

  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, storeId: access.store.id } });
  if (!variant) return { success: false, error: "Variant not found." };

  let barcode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    // Leading "2" is the GS1 range reserved for in-store/internal codes, so a
    // generated code can never equal a real retail barcode.
    const candidate = "2" + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
    const collision = await findIdentifierClash(access.store.id, { barcode: candidate });
    if (!collision) {
      barcode = candidate;
      break;
    }
  }
  if (!barcode) return { success: false, error: "Couldn't generate a unique barcode, try again." };

  try {
    await prisma.productVariant.update({ where: { id: variantId }, data: { barcode } });
  } catch (err: any) {
    if (err?.code === "P2002") return { success: false, error: "That barcode was just taken. Try again." };
    throw err;
  }
  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { barcode } };
}
