"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { toCsv, csvToRecords } from "@/lib/utils/csv";
import { roundMoney } from "@/lib/utils/pricing";
import type { ActionResult } from "@/types/actions";
import type { Store, Business } from "@prisma/client";

type StoreAccessResult =
  | { success: true; store: Store & { business: Business } }
  | { success: false; error: string };

async function assertStoreAccess(slug: string): Promise<StoreAccessResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false, error: "You don't have access to this store." };

  return { success: true, store };
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
    const rowNum = idx + 2; // +1 header, +1 for 1-indexing
    try {
      if (r.variantId) {
        const variant = await prisma.productVariant.findFirst({ where: { id: r.variantId, storeId: access.store.id } });
        if (!variant) {
          summary.errors++;
          summary.rows.push({ row: rowNum, status: "error", message: "variantId not found in this store" });
          continue;
        }
        const price = parseNum(r.price ?? "");
        const costPrice = parseNum(r.costPrice ?? "");
        const quantity = parseNum(r.quantity ?? "");
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            sku: r.sku?.trim() || variant.sku,
            barcode: r.barcode?.trim() || variant.barcode,
            price: r.price?.trim() === "" ? variant.price : price != null ? roundMoney(price) : variant.price,
            costPrice: r.costPrice?.trim() === "" ? variant.costPrice : costPrice != null ? roundMoney(costPrice) : variant.costPrice,
            quantity: quantity != null ? Math.max(0, Math.round(quantity)) : variant.quantity,
            lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? variant.lowStockThreshold,
            isActive: parseBool(r.isPublished ?? "", variant.isActive),
          },
        });
        summary.updated++;
        summary.rows.push({ row: rowNum, variantId: variant.id, status: "updated" });
        continue;
      }

      let categoryId: string | null | undefined = undefined;
      if (r.category?.trim()) {
        const cat = await prisma.category.findFirst({ where: { name: r.category.trim() } });
        categoryId = cat?.id ?? null;
      }

      if (r.productId) {
        const product = await prisma.product.findFirst({ where: { id: r.productId, storeId: access.store.id }, include: { inventory: true } });
        if (!product) {
          summary.errors++;
          summary.rows.push({ row: rowNum, status: "error", message: "productId not found in this store" });
          continue;
        }
        const price = parseNum(r.price ?? "");
        const quantity = parseNum(r.quantity ?? "");
        const costPrice = parseNum(r.costPrice ?? "");
        await prisma.product.update({
          where: { id: product.id },
          data: {
            ...(categoryId !== undefined ? { categoryId } : {}),
            price: price != null ? roundMoney(price) : product.price,
            isPublished: parseBool(r.isPublished ?? "", product.isPublished),
            inventory: {
              upsert: {
                create: {
                  storeId: access.store.id,
                  sku: r.sku?.trim() || null,
                  barcode: r.barcode?.trim() || null,
                  quantity: quantity != null ? Math.max(0, Math.round(quantity)) : 0,
                  costPrice: costPrice != null ? roundMoney(costPrice) : null,
                  lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? 5,
                },
                update: {
                  sku: r.sku?.trim() || product.inventory?.sku,
                  barcode: r.barcode?.trim() || product.inventory?.barcode,
                  quantity: quantity != null ? Math.max(0, Math.round(quantity)) : product.inventory?.quantity,
                  costPrice: r.costPrice?.trim() === "" ? product.inventory?.costPrice : costPrice != null ? roundMoney(costPrice) : product.inventory?.costPrice,
                  lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? product.inventory?.lowStockThreshold,
                },
              },
            },
          },
        });
        summary.updated++;
        summary.rows.push({ row: rowNum, productId: product.id, status: "updated" });
        continue;
      }

      // No productId/variantId -> create a new product.
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

      const baseSlug = slugify(r.name, { lower: true, strict: true });
      let productSlug = baseSlug;
      let suffix = 1;
      while (await prisma.product.findUnique({ where: { storeId_slug: { storeId: access.store.id, slug: productSlug } } })) {
        suffix += 1;
        productSlug = `${baseSlug}-${suffix}`;
      }

      const quantity = parseNum(r.quantity ?? "") ?? 0;
      const costPrice = parseNum(r.costPrice ?? "");

      const created = await prisma.product.create({
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
      });
      summary.created++;
      summary.rows.push({ row: rowNum, productId: created.id, status: "created" });
    } catch (err) {
      summary.errors++;
      summary.rows.push({ row: rowNum, status: "error", message: err instanceof Error ? err.message : "Unknown error" });
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
        if (nextQuantity !== product.inventory.quantity) {
          await tx.inventoryItem.update({ where: { id: product.inventory.id }, data: { quantity: nextQuantity } });
          await tx.stockMovement.create({
            data: {
              inventoryItemId: product.inventory.id,
              storeId: access.store.id,
              type: "CORRECTION",
              quantityChange: nextQuantity - product.inventory.quantity,
              quantityAfter: nextQuantity,
              note: "Bulk edit",
            },
          });
        }
      }
      updated++;
    }
  });

  revalidatePath(`/store/${slug}/admin/products`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: { updated } };
}
