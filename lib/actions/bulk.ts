"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { toCsv, csvToRecords } from "@/lib/utils/csv";
import { roundMoney } from "@/lib/utils/pricing";
import type { ActionResult } from "@/types/actions";
import { assertUnderPlanLimit } from "@/lib/entitlements";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// Bulk import/export is used from the Products page ("products" permission in dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "products");
}

const CSV_HEADERS = [
  "productId",
  "variantId",
  "name",
  "variant",
  "sku",
  "barcode",
  "category",
  "price",
  "compareAtPrice",
  "currency",
  "quantity",
  "costPrice",
  "lowStockThreshold",
  "isPublished",
  "inventoryUpdatedAt",
] as const;

/**
 * One row per plain product, plus one row per variant of a variant-enabled
 * product (so the same file round-trips through bulk editing regardless of
 * whether a listing has variants). variantId is blank on product rows and
 * on the variant rows' own productId column the parent product's id is
 * still filled in, so both levels stay linkable.
 */
export async function exportProductsCsv(slug: string): Promise<ActionResult<{ csv: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const products = await prisma.product.findMany({
    where: { storeId: access.store.id },
    include: { category: true, inventory: true, variants: true },
    orderBy: { createdAt: "asc" },
  });

  const rows: (string | number | boolean | null)[][] = [];

  for (const p of products) {
    if (p.hasVariants) {
      for (const v of p.variants) {
        rows.push([
          p.id,
          v.id,
          p.name,
          v.label,
          v.sku ?? "",
          v.barcode ?? "",
          p.category?.name ?? "",
          v.price != null ? Number(v.price) : "",
          "",
          p.currency,
          v.quantity,
          v.costPrice != null ? Number(v.costPrice) : "",
          v.lowStockThreshold,
          v.isActive,
          v.updatedAt.toISOString(),
        ]);
      }
    } else {
      rows.push([
        p.id,
        "",
        p.name,
        "",
        p.inventory?.sku ?? "",
        p.inventory?.barcode ?? "",
        p.category?.name ?? "",
        Number(p.price),
        p.compareAtPrice != null ? Number(p.compareAtPrice) : "",
        p.currency,
        p.inventory?.quantity ?? 0,
        p.inventory?.costPrice != null ? Number(p.inventory.costPrice) : "",
        p.inventory?.lowStockThreshold ?? 5,
        p.isPublished,
        p.inventory?.updatedAt?.toISOString() ?? "",
      ]);
    }
  }

  return { success: true, data: { csv: toCsv([...CSV_HEADERS], rows) } };
}

export type ImportRowResult = { row: number; productId?: string; variantId?: string; status: "created" | "updated" | "error"; message?: string };
export type ImportSummary = { created: number; updated: number; errors: number; rows: ImportRowResult[] };

function parseBool(v: string, fallback: boolean): boolean {
  const t = v.trim().toLowerCase();
  if (t === "") return fallback;
  return t === "true" || t === "1" || t === "yes";
}

function parseNum(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Upserts from a CSV in the exportProductsCsv shape.
 *  - A row with a variantId updates that variant (price/stock/sku/barcode/active).
 *  - A row with a productId (no variantId) updates that product's price/
 *    category/publish state and its plain InventoryItem's stock/sku/barcode.
 *  - A row with neither creates a new physical product with a fresh
 *    InventoryItem -- this path never creates variants, since a CSV row
 *    alone doesn't carry the option-axis schema a variant needs.
 * Every row is validated and applied independently in its own transaction,
 * so one bad row doesn't roll back the rest of the file.
 */
export async function importProductsCsv(slug: string, csvText: string): Promise<ActionResult<ImportSummary>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const records = csvToRecords(csvText);
  if (records.length === 0) return { success: false, error: "The file has no data rows." };
  if (records.length > 2000) return { success: false, error: "Import is limited to 2000 rows at a time." };

  const summary: ImportSummary = { created: 0, updated: 0, errors: 0, rows: [] };

  for (let idx = 0; idx < records.length; idx++) {
    const r = records[idx];
    const rowNum = idx + 2;
    try {
      if (r.variantId) {
        const result = await prisma.$transaction(async (tx) => {
          const variant = await tx.productVariant.findFirst({
            where: { id: r.variantId, storeId: access.store.id },
            select: { id: true, quantity: true, autoUnpublished: true, lowStockThreshold: true, sku: true, barcode: true, price: true, costPrice: true, isActive: true, updatedAt: true },
          });
          if (!variant) throw new Error("variantId not found in this store");

          const quantity = parseNum(r.quantity ?? "");
          const nextQuantity = quantity != null ? Math.max(0, Math.round(quantity)) : variant.quantity;
          const expectedUpdatedAt = r.inventoryUpdatedAt?.trim();
          if (expectedUpdatedAt) {
            const expected = new Date(expectedUpdatedAt);
            if (Number.isNaN(expected.getTime()) || expected.getTime() !== variant.updatedAt.getTime()) {
              throw new Error("INVENTORY_CONFLICT");
            }
          }

          const delta = nextQuantity - variant.quantity;
          const justRestocked = variant.quantity === 0 && nextQuantity > 0;
          const updated = await tx.productVariant.updateMany({
            where: { id: variant.id, storeId: access.store.id, updatedAt: variant.updatedAt },
            data: {
              sku: r.sku?.trim() || variant.sku,
              barcode: r.barcode?.trim() || variant.barcode,
              price: r.price?.trim() === "" ? variant.price : (parseNum(r.price ?? "") != null ? roundMoney(parseNum(r.price)!) : variant.price),
              costPrice: r.costPrice?.trim() === "" ? variant.costPrice : (parseNum(r.costPrice ?? "") != null ? roundMoney(parseNum(r.costPrice)!) : variant.costPrice),
              quantity: nextQuantity,
              lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? variant.lowStockThreshold,
              isActive: parseBool(r.isPublished ?? "", variant.isActive),
              autoUnpublished: justRestocked ? false : variant.autoUnpublished,
            },
          });
          if (updated.count !== 1) throw new Error("INVENTORY_CONFLICT");

          if (delta !== 0) {
            await tx.stockMovement.create({
              data: {
                variantId: variant.id,
                storeId: access.store.id,
                type: "CORRECTION",
                quantityChange: delta,
                quantityAfter: nextQuantity,
                note: "CSV import",
              },
            });
          }
          return variant.id;
        }, { isolationLevel: "Serializable", timeout: 15000 });

        summary.updated++;
        summary.rows.push({ row: rowNum, variantId: result, status: "updated" });
        continue;
      }

      let categoryId: string | null | undefined = undefined;
      if (r.category?.trim()) {
        const cat = await prisma.category.findFirst({ where: { name: r.category.trim(), storeId: access.store.id } });
        categoryId = cat?.id ?? null;
      }

      if (r.productId) {
        const result = await prisma.$transaction(async (tx) => {
          const product = await tx.product.findFirst({
            where: { id: r.productId, storeId: access.store.id },
            include: { inventory: true },
          });
          if (!product) throw new Error("productId not found in this store");

          const quantity = parseNum(r.quantity ?? "");
          const nextQuantity = quantity != null ? Math.max(0, Math.round(quantity)) : product.inventory?.quantity ?? 0;
          const expectedUpdatedAt = r.inventoryUpdatedAt?.trim();
          if (expectedUpdatedAt && product.inventory) {
            const expected = new Date(expectedUpdatedAt);
            if (Number.isNaN(expected.getTime()) || expected.getTime() !== product.inventory.updatedAt.getTime()) {
              throw new Error("INVENTORY_CONFLICT");
            }
          }

          const inventoryData = {
            sku: r.sku?.trim() || product.inventory?.sku || null,
            barcode: r.barcode?.trim() || product.inventory?.barcode || null,
            quantity: nextQuantity,
            costPrice: r.costPrice?.trim() === "" ? product.inventory?.costPrice ?? null : (parseNum(r.costPrice ?? "") != null ? roundMoney(parseNum(r.costPrice)!) : product.inventory?.costPrice ?? null),
            lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? product.inventory?.lowStockThreshold ?? 5,
          };

          let delta = 0;
          if (product.inventory) {
            delta = nextQuantity - product.inventory.quantity;
            const justRestocked = product.inventory.quantity === 0 && nextQuantity > 0;
            const updated = await tx.inventoryItem.updateMany({
              where: { id: product.inventory.id, storeId: access.store.id, updatedAt: product.inventory.updatedAt },
              data: {
                ...inventoryData,
                autoUnpublished: justRestocked ? false : product.inventory.autoUnpublished,
              },
            });
            if (updated.count !== 1) throw new Error("INVENTORY_CONFLICT");

            if (delta !== 0) {
              await tx.stockMovement.create({
                data: {
                  inventoryItemId: product.inventory.id,
                  storeId: access.store.id,
                  type: "CORRECTION",
                  quantityChange: delta,
                  quantityAfter: nextQuantity,
                  note: "CSV import",
                },
              });
            }
            if (product.inventory.quantity > 0 && nextQuantity === 0) {
              await tx.product.update({ where: { id: product.id }, data: { isPublished: false } });
            } else if (product.inventory.quantity === 0 && nextQuantity > 0 && product.inventory.autoUnpublished) {
              await tx.product.update({ where: { id: product.id }, data: { isPublished: true } });
            }
          } else {
            await tx.inventoryItem.create({ data: { productId: product.id, storeId: access.store.id, ...inventoryData } });
            delta = nextQuantity;
            if (nextQuantity > 0) {
              await tx.stockMovement.create({
                data: {
                  inventoryItemId: (await tx.inventoryItem.findUnique({ where: { productId: product.id }, select: { id: true } }))!.id,
                  storeId: access.store.id,
                  type: "RESTOCK",
                  quantityChange: nextQuantity,
                  quantityAfter: nextQuantity,
                  note: "CSV import initial stock",
                },
              });
            }
          }

          await tx.product.update({
            where: { id: product.id },
            data: {
              ...(categoryId !== undefined ? { categoryId } : {}),
              price: parseNum(r.price ?? "") != null ? roundMoney(parseNum(r.price)!) : product.price,
              isPublished: parseBool(r.isPublished ?? "", product.isPublished),
            },
          });
          return product.id;
        }, { isolationLevel: "Serializable", timeout: 15000 });

        summary.updated++;
        summary.rows.push({ row: rowNum, productId: result, status: "updated" });
        continue;
      }

      const entitlement = await assertUnderPlanLimit(access.store.id, "products");
      if (!entitlement.allowed) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: entitlement.error });
        continue;
      }
      if (!r.name?.trim()) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "name is required to create a new product" });
        continue;
      }
      const price = parseNum(r.price ?? "");
      if (price == null || price <= 0) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "a positive price is required to create a new product" });
        continue;
      }

      const quantity = parseNum(r.quantity ?? "") ?? 0;
      const costPrice = parseNum(r.costPrice ?? "");
      const baseSlug = slugify(r.name, { lower: true, strict: true });
      let productSlug = baseSlug;
      let suffix = 1;
      while (await prisma.product.findUnique({ where: { storeId_slug: { storeId: access.store.id, slug: productSlug } } })) {
        suffix += 1;
        productSlug = `${baseSlug}-${suffix}`;
      }

      const created = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            storeId: access.store.id,
            categoryId: categoryId || null,
            type: "PHYSICAL",
            name: r.name.trim(),
            slug: productSlug,
            description: r.name.trim(),
            price: roundMoney(price),
            currency: r.currency?.trim() || "NGN",
            images: [],
            isPublished: parseBool(r.isPublished ?? "", true),
            inventory: {
              create: {
                storeId: access.store.id,
                sku: r.sku?.trim() || null,
                barcode: r.barcode?.trim() || null,
                quantity: Math.max(0, Math.round(quantity)),
                costPrice: costPrice != null ? roundMoney(costPrice) : null,
                lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? 5,
              },
            },
          },
          include: { inventory: true },
        });
        if (quantity > 0 && product.inventory) {
          await tx.stockMovement.create({
            data: {
              inventoryItemId: product.inventory.id,
              storeId: access.store.id,
              type: "RESTOCK",
              quantityChange: Math.max(0, Math.round(quantity)),
              quantityAfter: Math.max(0, Math.round(quantity)),
              note: "CSV import initial stock",
            },
          });
        }
        return product.id;
      }, { isolationLevel: "Serializable", timeout: 15000 });

      summary.created++;
      summary.rows.push({ row: rowNum, productId: created, status: "created" });
    } catch (err) {
      summary.errors++;
      const message = err instanceof Error ? err.message : "Unknown error";
      summary.rows.push({
        row: rowNum,
        status: "error",
        message: message === "INVENTORY_CONFLICT" ? "Inventory changed since this CSV was exported. Re-export the products and try again." : message,
      });
    }
  }

  revalidatePath(`/store/${slug}/admin/products`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: summary };
}

// --- Bulk editing (dashboard multi-select, not file-based) -----------------

export type BulkEditPatch = {
  productId: string;
  price?: number;
  quantity?: number;
  categoryId?: string | null;
  isPublished?: boolean;
};

/**
 * Applies price/stock/category/publish changes to many products in one
 * pass, for the "select rows -> bulk edit" flow on the products page.
 * Stock changes go through prisma directly (not adjustStock's ledger)
 * with a single synthetic StockMovement per item, so a 50-row bulk edit
 * doesn't fire 50 separate transactions/emails -- it's one CORRECTION
 * entry per changed item, same as any other stock correction.
 */
export async function bulkUpdateProducts(slug: string, patches: BulkEditPatch[]): Promise<ActionResult<{ updated: number }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  if (patches.length === 0) return { success: false, error: "Nothing selected." };
  if (patches.length > 500) return { success: false, error: "Bulk edit is limited to 500 products at a time." };

  const ids = patches.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, storeId: access.store.id },
    include: { inventory: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  let updated = 0;
  try {
    await prisma.$transaction(async (tx) => {
    for (const patch of patches) {
      const product = byId.get(patch.productId);
      if (!product) continue;

      const productData: Record<string, unknown> = {};
      if (patch.price != null && patch.price > 0) productData.price = roundMoney(patch.price);
      if (patch.categoryId !== undefined) productData.categoryId = patch.categoryId;
      if (patch.isPublished !== undefined) productData.isPublished = patch.isPublished;
      if (Object.keys(productData).length > 0) {
        await tx.product.update({ where: { id: product.id }, data: productData });
      }

      if (patch.quantity != null && product.inventory) {
        const nextQuantity = Math.max(0, Math.round(patch.quantity));

        // Bulk quantity edits are absolute values, so silently applying a
        // stale value would overwrite stock changed by another staff member
        // (sale, restock, refund, or another bulk edit). The initial query is
        // the user's edit snapshot; re-read inside the transaction and abort
        // the whole batch if that inventory row has changed since the snapshot.
        const currentInventory = await tx.inventoryItem.findFirst({
          where: { id: product.inventory.id, storeId: access.store.id },
          select: { id: true, quantity: true },
        });
        if (!currentInventory) throw new Error("Inventory item not found.");
        if (currentInventory.quantity !== product.inventory.quantity) {
          throw new Error(`INVENTORY_CONFLICT:${product.id}`);
        }

        if (nextQuantity !== currentInventory.quantity) {
          const updated = await tx.inventoryItem.updateMany({
            where: {
              id: currentInventory.id,
              storeId: access.store.id,
              quantity: currentInventory.quantity,
            },
            data: { quantity: nextQuantity },
          });
          if (updated.count !== 1) throw new Error(`INVENTORY_CONFLICT:${product.id}`);

          await tx.stockMovement.create({
            data: {
              inventoryItemId: currentInventory.id,
              storeId: access.store.id,
              type: "CORRECTION",
              quantityChange: nextQuantity - currentInventory.quantity,
              quantityAfter: nextQuantity,
              note: "Bulk edit",
            },
          });
        }
      }
      updated++;
      }
    }, { isolationLevel: "Serializable", timeout: 15000 });
  } catch (err: any) {
    if (err?.message?.startsWith("INVENTORY_CONFLICT:")) {
      return { success: false, error: "One or more inventory quantities changed while you were editing. Refresh the products page and apply the bulk edit again." };
    }
    if (err?.code === "P2034") {
      return { success: false, error: "Inventory changed concurrently. Refresh the products page and try the bulk edit again." };
    }
    return { success: false, error: err instanceof Error ? err.message : "Couldn't update products safely." };
  }

  revalidatePath(`/store/${slug}/admin/products`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: { updated } };
}
