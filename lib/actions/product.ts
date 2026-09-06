"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import type { ActionResult } from "@/types/actions";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/actions/activity";
import { assertUnderPlanLimit } from "@/lib/entitlements";

import type { Store, Business } from "@prisma/client";

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

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
  const access = await assertStoreAccess(slug);
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
      where: { id: data.categoryId, storeId: access.store.id },
      select: { id: true },
    });
    if (!category) return { success: false, error: "Category does not belong to this store." };
  }

  const trimmedSku = data.sku?.trim() || null;
  const trimmedBarcode = data.barcode?.trim() || null;
  if (trimmedBarcode) {
    const clash = await prisma.inventoryItem.findFirst({
      where: { storeId: access.store.id, barcode: trimmedBarcode },
    });
    if (clash) {
      return {
        success: false,
        error: "That barcode is already in use.",
        fieldErrors: { barcode: ["Already in use"] },
      };
    }
  }
  if (trimmedSku) {
    const clash = await prisma.inventoryItem.findFirst({
      where: { storeId: access.store.id, sku: trimmedSku },
    });
    if (clash) {
      return {
        success: false,
        error: "That SKU is already in use.",
        fieldErrors: { sku: ["Already in use"] },
      };
    }
  }

  const baseSlug = slugify(data.name, { lower: true, strict: true });
  let productSlug = baseSlug;
  let suffix = 1;
  while (
    await prisma.product.findUnique({
      where: { storeId_slug: { storeId: access.store.id, slug: productSlug } },
    })
  ) {
    suffix += 1;
    productSlug = `${baseSlug}-${suffix}`;
  }

  const product = await prisma.product.create({
    data: {
      storeId: access.store.id,
      categoryId: data.categoryId || null,
      type: data.type,
      name: data.name,
      slug: productSlug,
      description: data.description,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      currency: data.currency,
      images: data.images,
      isPublished: data.isPublished,
      digitalFileUrl: data.digitalFileUrl || null,
      rentalPeriodUnit: data.rentalPeriodUnit ?? null,
      attributes: data.attributes ?? undefined,
      inventory: {
        create: { quantity: data.quantity, storeId: access.store.id, sku: trimmedSku, barcode: trimmedBarcode },
      },
    },
  });

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
  input: ProductInput
): Promise<ActionResult<{ productId: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

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
      where: { id: data.categoryId, storeId: access.store.id },
      select: { id: true },
    });
    if (!category) return { success: false, error: "Category does not belong to this store." };
  }

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
  });
  if (!existing) return { success: false, error: "Product not found." };

  const trimmedSku = data.sku?.trim() || null;
  const trimmedBarcode = data.barcode?.trim() || null;
  if (trimmedBarcode) {
    const clash = await prisma.inventoryItem.findFirst({
      where: { storeId: access.store.id, barcode: trimmedBarcode, NOT: { productId } },
    });
    if (clash) {
      return {
        success: false,
        error: "That barcode is already in use.",
        fieldErrors: { barcode: ["Already in use"] },
      };
    }
  }
  if (trimmedSku) {
    const clash = await prisma.inventoryItem.findFirst({
      where: { storeId: access.store.id, sku: trimmedSku, NOT: { productId } },
    });
    if (clash) {
      return {
        success: false,
        error: "That SKU is already in use.",
        fieldErrors: { sku: ["Already in use"] },
      };
    }
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

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.product.findFirst({
          where: { id: productId, storeId: access.store.id },
          include: { inventory: true },
        });
        if (!current) throw new Error("Product not found.");

        let inventoryData: { quantity: number; sku: string | null; barcode: string | null } | undefined;
        if (current.hasVariants) {
          // Parent quantity/SKU/barcode are not authoritative once variants
          // exist. Do not include the relation write at all: an upsert requires
          // a non-null create payload when no legacy parent inventory exists.
          inventoryData = undefined;
        } else if (current.inventory) {
          const nextQuantity = Math.max(0, Math.round(data.quantity));
          const delta = nextQuantity - current.inventory.quantity;
          if (delta !== 0) {
            const updated = await tx.inventoryItem.updateMany({
              where: { id: current.inventory.id, storeId: access.store.id, quantity: current.inventory.quantity },
              data: { quantity: nextQuantity },
            });
            if (updated.count !== 1) throw new Error("INVENTORY_CONFLICT");
            await tx.stockMovement.create({
              data: {
                inventoryItemId: current.inventory.id,
                storeId: access.store.id,
                type: "CORRECTION",
                quantityChange: delta,
                quantityAfter: nextQuantity,
                note: "Product edit",
              },
            });
            quantityChanged = true;
            quantityDelta = delta;
            resultingQuantity = nextQuantity;
          }
          inventoryData = { quantity: nextQuantity, sku: trimmedSku, barcode: trimmedBarcode };
        } else {
          inventoryData = { quantity: Math.max(0, Math.round(data.quantity)), sku: trimmedSku, barcode: trimmedBarcode };
        }

        await tx.product.update({
          where: { id: productId },
          data: {
            categoryId: data.categoryId || null,
            type: data.type,
            name: data.name,
            description: data.description,
            price: data.price,
            compareAtPrice: data.compareAtPrice || null,
            currency: data.currency,
            images: data.images,
            isPublished: data.isPublished,
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

        return { quantityChanged: delta !== 0, quantityDelta: delta, resultingQuantity: nextQuantity };
      }, { isolationLevel: "Serializable", timeout: 15000 });

      quantityChanged = result.quantityChanged;
      quantityDelta = result.quantityDelta;
      resultingQuantity = result.resultingQuantity;
      break;
    } catch (err: any) {
      if (err?.message === "Product not found.") return { success: false, error: err.message };
      if (err?.message === "INVENTORY_CONFLICT" && attempt < 2) continue;
      if (err?.code === "P2034" && attempt < 2) continue;
      return { success: false, error: "Couldn't update the product safely. Please try again." };
    }
  }

  await emitWebhookEvent("PRODUCT_UPDATED", access.store.id, {
    productId,
    name: data.name,
    price: data.price,
    currency: data.currency,
    isPublished: data.isPublished,
  });

  const session = await auth();
  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "product.updated",
    target: data.name,
    metadata: { productId },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { productId } };
}

export async function deleteProduct(slug: string, productId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
  });
  if (!existing) return { success: false, error: "Product not found." };

  await prisma.product.delete({ where: { id: productId } });

  const session = await auth();
  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "product.deleted",
    target: existing.name,
    metadata: { productId },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: undefined };
}
