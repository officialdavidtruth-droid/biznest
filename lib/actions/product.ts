"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { roundMoney } from "@/lib/utils/pricing";
import type { ActionResult } from "@/types/actions";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/activity-log";
import { assertUnderPlanLimit } from "@/lib/entitlements";
import { findIdentifierClash, clashResult } from "@/lib/catalog-identifiers";
import { createFifoBatchTx, recordBatchLedgerForQuantityChangeTx } from "@/lib/inventory-fifo";

import type { Store, Business } from "@prisma/client";

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

/**
 * Digital file references must be ones this user uploaded (the upload folder is
 * biznest/<userId>/digital). An unchanged existing value is always accepted so
 * other staff and legacy https links keep working; anything new that is not the
 * caller's own private upload is rejected.
 */
async function checkDigitalRef(value: string | null | undefined, existing: string | null): Promise<string | null> {
  if (!value || value === existing) return null;
  const session = await auth();
  const m = value.match(/^private-asset:\/\/biznest\/([^/]+)\/digital\//);
  if (m && session?.user?.id && m[1] === session.user.id) return null;
  return m ? "That file wasn't uploaded from your account. Upload it again." : "Upload the file instead of pasting a link, so only paying buyers can download it.";
}

/**
 * Confirms the current user has "products" access to this store — owner,
 * platform staff, or an invited MANAGER/STAFF who was granted the
 * "Products & inventory" checkbox at invite time. Every product mutation
 * below calls this first — never trust a storeId/slug passed from the
 * client without this check. (Previously this only allowed the owner or
 * platform staff, so an invited staff member's "Products & inventory"
 * permission had no actual effect — see assertStorePermission.)
 */
async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const result = await assertStorePermission(slug, "products");
  if (!result.success) return result;
  return { success: true, store: result.store };
}

async function assertMenuEditor(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return a;
  // Anyone granted the "products" permission (including STAFF) may create, edit and delete products and variants.
  return a;
}


export async function listProducts(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  return prisma.product.findMany({
    where: { storeId: access.store.id },
    include: { category: true, inventory: true, variants: { select: { quantity: true, isActive: true } }, _count: { select: { orderItems: true } } },
    orderBy: { createdAt: "desc" },
    // No pagination UI on this page yet -- bounded so a growing catalog
    // doesn't make the admin products list get slower every month. Raise
    // this (or add real pagination) if a store's active catalog ever
    // exceeds 300 products.
    take: 300,
  });
}

/**
 * Accurate catalog counts straight from the database. listProducts is capped
 * at 300 rows, so the dashboard cards and category counts must not be derived
 * from it. Out of stock only applies to physical products that actually track
 * stock (same rule the storefront uses).
 */
export async function getProductStats(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;
  const storeId = access.store.id;

  const [total, published, outPlain, outVariant, byCategory] = await Promise.all([
    prisma.product.count({ where: { storeId } }),
    prisma.product.count({ where: { storeId, isPublished: true } }),
    prisma.product.count({ where: { storeId, type: "PHYSICAL", hasVariants: false, inventory: { is: { quantity: { lte: 0 } } } } }),
    prisma.product.count({ where: { storeId, type: "PHYSICAL", hasVariants: true, variants: { none: { isActive: true, quantity: { gt: 0 } } } } }),
    prisma.product.groupBy({ by: ["categoryId"], where: { storeId }, _count: { _all: true } }),
  ]);

  return {
    total,
    published,
    outOfStock: outPlain + outVariant,
    byCategory: Object.fromEntries(byCategory.filter((r) => r.categoryId).map((r) => [r.categoryId as string, r._count._all])) as Record<string, number>,
  };
}

export async function getProduct(slug: string, productId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
    include: { inventory: true },
  });
}

export async function createProduct(
  slug: string,
  input: ProductInput
): Promise<ActionResult<{ productId: string }>> {
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };

  const entitlement = await assertUnderPlanLimit(access.store.id, "products");
  if (!entitlement.allowed) return { success: false, error: entitlement.error };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, storeId: access.store.id, type: "PRODUCT" },
      select: { id: true },
    });
    if (!category) return { success: false, error: "Choose a product category from this store." };
  }

  const fileError = await checkDigitalRef(data.digitalFileUrl, null);
  if (fileError) return { success: false, error: fileError, fieldErrors: { digitalFileUrl: [fileError] } };

  const trimmedSku = data.sku?.trim() || null;
  const trimmedBarcode = data.barcode?.trim() || null;
  const clash = await findIdentifierClash(access.store.id, { sku: trimmedSku, barcode: trimmedBarcode });
  if (clash) return clashResult(clash);

  const baseSlug = slugify(data.name, { lower: true, strict: true }) || "item";
  let productSlug = baseSlug;
  let suffix = 1;
  // Fast path only: the unique index below is the real guard against a race.
  while (
    await prisma.product.findUnique({
      where: { storeId_slug: { storeId: access.store.id, slug: productSlug } },
    })
  ) {
    suffix += 1;
    productSlug = `${baseSlug}-${suffix}`;
  }

  const createError = { success: false as const, error: "Couldn't create the product. Please try again." };
  let product: { id: string; name: string; price: unknown; currency: string; isPublished: boolean } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      product = await prisma.$transaction(async (tx) => {
        // Plan limit is checked inside the Serializable transaction so two
        // concurrent creates can't both pass it.
        const limit = await assertUnderPlanLimit(access.store.id, "products", tx);
        if (!limit.allowed) throw new Error(`PLAN_LIMIT:${limit.error}`);
        const created = await tx.product.create({
          data: {
            storeId: access.store.id,
            categoryId: data.categoryId || null,
            type: data.type,
            name: data.name,
            slug: productSlug,
            description: data.description,
            price: roundMoney(data.price),
            compareAtPrice: data.compareAtPrice ? roundMoney(data.compareAtPrice) : null,
            currency: access.store.currency,
            images: data.images,
            isPublished: data.isPublished,
            digitalFileUrl: data.digitalFileUrl || null,
            rentalPeriodUnit: data.rentalPeriodUnit ?? null,
            attributes: data.attributes ?? undefined,
            inventory: {
              create: { quantity: data.quantity, storeId: access.store.id, sku: trimmedSku, barcode: trimmedBarcode },
            },
          },
          include: { inventory: true },
        });
        // Opening stock gets a RESTOCK movement and a receipt lot so the ledger and
        // batches start in agreement instead of relying on a synthetic 1970 lot.
        if (created.inventory && created.inventory.quantity > 0) {
          await tx.stockMovement.create({
            data: { inventoryItemId: created.inventory.id, storeId: access.store.id, type: "RESTOCK", quantityChange: created.inventory.quantity, quantityAfter: created.inventory.quantity, note: "Initial stock" },
          });
          await createFifoBatchTx(tx, { inventoryItemId: created.inventory.id, storeId: access.store.id, quantity: created.inventory.quantity, sourceNote: "Initial stock" });
        }
        return created;
      }, { isolationLevel: "Serializable", timeout: 15000 });
      break;
    } catch (err: any) {
      if (typeof err?.message === "string" && err.message.startsWith("PLAN_LIMIT:")) {
        return { success: false, error: err.message.slice("PLAN_LIMIT:".length) };
      }
      if (err?.code === "P2034" && attempt < 4) continue;
      if (err?.code === "P2002") {
        const target = String(err?.meta?.target ?? "");
        if (target.includes("slug")) {
          suffix += 1;
          productSlug = `${baseSlug}-${suffix}`;
          continue;
        }
        if (target.includes("barcode")) return clashResult({ field: "barcode" });
        if (target.includes("sku")) return clashResult({ field: "sku" });
      }
      return createError;
    }
  }
  if (!product) return createError;

  await emitWebhookEvent("PRODUCT_CREATED", access.store.id, {
    productId: product.id,
    name: product.name,
    price: Number(product.price),
    currency: product.currency,
    isPublished: product.isPublished,
  });

  const session = await auth();
  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "product.created",
    target: product.name,
    metadata: { productId: product.id },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { productId: product.id } };
}

export async function updateProduct(
  slug: string,
  productId: string,
  input: ProductInput,
  // The on-hand quantity the edit form was loaded with. Stock is only touched
  // when the submitted quantity differs from this baseline, and only if live
  // stock still equals it -- otherwise a stale form would undo sales/restocks.
  opts?: { baselineQuantity?: number }
): Promise<ActionResult<{ productId: string }>> {
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };
  const baselineQuantity =
    typeof opts?.baselineQuantity === "number" && Number.isInteger(opts.baselineQuantity) && opts.baselineQuantity >= 0
      ? opts.baselineQuantity
      : null;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, storeId: access.store.id, type: "PRODUCT" },
      select: { id: true },
    });
    if (!category) return { success: false, error: "Choose a product category from this store." };
  }

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
  });
  if (!existing) return { success: false, error: "Product not found." };

  const fileError = await checkDigitalRef(data.digitalFileUrl, existing.digitalFileUrl);
  if (fileError) return { success: false, error: fileError, fieldErrors: { digitalFileUrl: [fileError] } };

  const trimmedSku = data.sku?.trim() || null;
  const trimmedBarcode = data.barcode?.trim() || null;
  // Variant products ignore the parent SKU/barcode, so only check plain products.
  if (!existing.hasVariants) {
    const clash = await findIdentifierClash(access.store.id, { sku: trimmedSku, barcode: trimmedBarcode }, { productId });
    if (clash) return clashResult(clash);
  }

  // Variant-enabled products have per-variant stock as their sole sellable
  // inventory source. The legacy parent InventoryItem may still exist for
  // historical compatibility, but must never be recreated or overwritten by
  // the generic product editor.
  //
  // Product edits that change on-hand quantity must use the same ledgered,
  // serializable inventory path as the inventory screen. Never silently
  // overwrite a concurrently changed quantity or leave the stock history
  // without a corresponding movement.
  let quantityChanged = false;
  let quantityDelta = 0;
  let resultingQuantity = data.quantity;
  // What the published flag actually ended up as (the out-of-stock automation
  // can override the submitted value inside the transaction).
  let finalPublished = data.isPublished;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.product.findFirst({
          where: { id: productId, storeId: access.store.id },
          include: { inventory: true },
        });
        if (!current) throw new Error("Product not found.");

        let inventoryData: { quantity: number; sku: string | null; barcode: string | null; storeId: string } | undefined;
        let delta = 0;
        let publishOverride: boolean | null = null;
        let nextQuantity = Math.max(0, Math.round(data.quantity));
        if (current.hasVariants) {
          // Parent quantity/SKU/barcode are not authoritative once variants
          // exist. Do not include the relation write at all: an upsert requires
          // a non-null create payload when no legacy parent inventory exists.
          inventoryData = undefined;
        } else if (current.inventory) {
          if (baselineQuantity !== null) {
            if (nextQuantity === baselineQuantity) {
              // Quantity field untouched by the editor: keep live stock as-is.
              nextQuantity = current.inventory.quantity;
            } else if (current.inventory.quantity !== baselineQuantity) {
              // Editor changed stock, but it moved since the form opened.
              throw new Error("STALE_STOCK");
            }
          }
          delta = nextQuantity - current.inventory.quantity;
          if (delta !== 0) {
            // Same out-of-stock automation as adjustStock / CSV import: running
            // out takes the listing down, and a restock only republishes what
            // the automation (not the merchant) unpublished.
            const justRanOut = current.inventory.quantity > 0 && nextQuantity === 0;
            const justRestocked = current.inventory.quantity === 0 && nextQuantity > 0;
            if (justRanOut) publishOverride = false;
            else if (justRestocked && current.inventory.autoUnpublished) publishOverride = true;
            const updated = await tx.inventoryItem.updateMany({
              where: { id: current.inventory.id, storeId: access.store.id, quantity: current.inventory.quantity },
              data: {
                quantity: nextQuantity,
                autoUnpublished: justRanOut ? true : justRestocked ? false : current.inventory.autoUnpublished,
              },
            });
            if (updated.count !== 1) throw new Error("INVENTORY_CONFLICT");
            const movement = await tx.stockMovement.create({
              data: {
                inventoryItemId: current.inventory.id,
                storeId: access.store.id,
                type: "CORRECTION",
                quantityChange: delta,
                quantityAfter: nextQuantity,
                note: "Product edit",
              },
            });
            await recordBatchLedgerForQuantityChangeTx(tx, {
              inventoryItemId: current.inventory.id,
              storeId: access.store.id,
              delta,
              stockMovementId: movement.id,
              unitCost: current.inventory.costPrice == null ? null : Number(current.inventory.costPrice),
              sourceNote: "Product edit",
            });
            quantityChanged = true;
            quantityDelta = delta;
            resultingQuantity = nextQuantity;
          }
          inventoryData = { quantity: nextQuantity, sku: trimmedSku, barcode: trimmedBarcode, storeId: access.store.id };
        } else {
          inventoryData = { quantity: nextQuantity, sku: trimmedSku, barcode: trimmedBarcode, storeId: access.store.id };
        }

        await tx.product.update({
          where: { id: productId },
          data: {
            categoryId: data.categoryId || null,
            type: data.type,
            name: data.name,
            description: data.description,
            price: roundMoney(data.price),
            compareAtPrice: data.compareAtPrice ? roundMoney(data.compareAtPrice) : null,
            currency: existing.currency,
            images: data.images,
            isPublished: publishOverride ?? data.isPublished,
            digitalFileUrl: data.digitalFileUrl || null,
            rentalPeriodUnit: data.rentalPeriodUnit ?? null,
            attributes: data.attributes ?? undefined,
            ...(inventoryData
              ? {
                  inventory: {
                    upsert: {
                      create: inventoryData,
                      update: { sku: trimmedSku, barcode: trimmedBarcode },
                    },
                  },
                }
              : {}),
          },
        });

        // Stock created by the upsert above (product had no inventory row yet)
        // needs its own opening movement + lot, otherwise it has no ledger.
        if (!current.hasVariants && !current.inventory && nextQuantity > 0) {
          const created = await tx.inventoryItem.findUnique({ where: { productId }, select: { id: true } });
          if (created) {
            const movement = await tx.stockMovement.create({
              data: { inventoryItemId: created.id, storeId: access.store.id, type: "RESTOCK", quantityChange: nextQuantity, quantityAfter: nextQuantity, note: "Product edit initial stock" },
            });
            await createFifoBatchTx(tx, { inventoryItemId: created.id, storeId: access.store.id, quantity: nextQuantity, sourceNote: "Product edit initial stock" });
            delta = nextQuantity;
          }
        }

        return { quantityChanged: delta !== 0, quantityDelta: delta, resultingQuantity: nextQuantity, isPublished: publishOverride ?? data.isPublished };
      }, { isolationLevel: "Serializable", timeout: 15000 });

      quantityChanged = result.quantityChanged;
      quantityDelta = result.quantityDelta;
      resultingQuantity = result.resultingQuantity;
      finalPublished = result.isPublished;
      break;
    } catch (err: any) {
      if (err?.message === "Product not found.") return { success: false, error: err.message };
      if (err?.message === "STALE_STOCK") {
        return { success: false, error: "Stock changed since you opened this page (a sale or restock). Reload to see the current quantity, then re-apply your stock change." };
      }
      if (err?.message === "INVENTORY_CONFLICT" && attempt < 2) continue;
      if (err?.code === "P2034" && attempt < 2) continue;
      if (err?.code === "P2002") {
        const target = String(err?.meta?.target ?? "");
        if (target.includes("barcode")) return clashResult({ field: "barcode" });
        if (target.includes("sku")) return clashResult({ field: "sku" });
      }
      return { success: false, error: "Couldn't update the product safely. Please try again." };
    }
  }

  await emitWebhookEvent("PRODUCT_UPDATED", access.store.id, {
    productId,
    name: data.name,
    price: roundMoney(data.price),
    currency: existing.currency,
    isPublished: finalPublished,
  });

  const session = await auth();
  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "product.updated",
    target: data.name,
    metadata: {
      productId,
      // Before/after for the changes merchants most often need to trace.
      ...(Number(existing.price) !== roundMoney(data.price) ? { price: { from: Number(existing.price), to: roundMoney(data.price) } } : {}),
      ...(existing.isPublished !== finalPublished ? { isPublished: { from: existing.isPublished, to: finalPublished } } : {}),
      ...(quantityChanged ? { quantity: { change: quantityDelta, after: resultingQuantity } } : {}),
    },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { productId } };
}

export async function deleteProduct(slug: string, productId: string): Promise<ActionResult<{ archived: boolean }>> {
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
  });
  if (!existing) return { success: false, error: "Product not found." };

  // A product that appears on orders or purchase orders keeps its history:
  // hard-deleting it would null the product link on those records. Take it
  // off the storefront instead and keep the row.
  // Stock records (InventoryItem, StockMovement, FIFO batches) cascade from the
  // product, so a product with stock or any stock history is archived too --
  // hard-deleting it would erase the ledger and write stock off unrecorded.
  const [orderRefs, purchaseRefs, movementRefs, liveStock] = await Promise.all([
    prisma.orderItem.count({ where: { productId } }),
    prisma.purchaseOrderItem.count({ where: { productId } }),
    prisma.stockMovement.count({ where: { storeId: access.store.id, OR: [{ inventoryItem: { productId } }, { variant: { productId } }] } }),
    Promise.all([
      prisma.inventoryItem.count({ where: { productId, quantity: { gt: 0 } } }),
      prisma.productVariant.count({ where: { productId, quantity: { gt: 0 } } }),
    ]).then(([a, b]) => a + b),
  ]);
  const archived = orderRefs + purchaseRefs + movementRefs + liveStock > 0;

  if (archived) {
    await prisma.product.update({ where: { id: productId }, data: { isPublished: false } });
  } else {
    await prisma.product.delete({ where: { id: productId } });
  }

  // Subscribers hear about a real deletion; an archive is just an unpublish.
  await emitWebhookEvent(archived ? "PRODUCT_UPDATED" : "PRODUCT_DELETED", access.store.id, {
    productId,
    name: existing.name,
    ...(archived ? { isPublished: false } : {}),
  });

  const session = await auth();
  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: archived ? "product.archived" : "product.deleted",
    target: existing.name,
    metadata: { productId, ...(archived ? { orderRefs, purchaseRefs, movementRefs, liveStock } : {}) },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { archived } };
}