"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { toCsv, csvToRecords, unescapeFormulaCell } from "@/lib/utils/csv";
import { roundMoney } from "@/lib/utils/pricing";
import type { ActionResult } from "@/types/actions";
import { assertUnderPlanLimit } from "@/lib/entitlements";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { createFifoBatchTx, recordBatchLedgerForQuantityChangeTx } from "@/lib/inventory-fifo";
import { decidePublishAfterStockChange } from "@/lib/catalog/publish";
import { correctInventoryQuantityTx } from "@/lib/catalog/stock";
import { reportCatalogChange } from "@/lib/catalog/report";
import { findIdentifierClash } from "@/lib/catalog-identifiers";
import { isSafeImageUrl } from "@/lib/builder-safe";

// Same bounds as productSchema so a CSV row can't create what the form would reject.
const MAX_PRICE = 999_999_999;
const MAX_QUANTITY = 1_000_000;

const toCost = (v: unknown): number | null => (v == null ? null : Number(v));

// Bulk import/export is used from the Products page ("products" permission in dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "products");
}

async function assertMenuEditor(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return a;
  // Anyone granted the "products" permission (including STAFF) may edit products,
  // the same rule product.ts and variant.ts apply. This used to reject STAFF here
  // only, so a staff member could delete a product but not hide it.
  return a;
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
  "imageUrl",
] as const;

/** The picture column: an https URL (or site path) for a product's main image. Blank leaves images alone. */
function parseImageUrl(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  if (t.length > 2000 || !/^(https:\/\/|\/(?!\/))/i.test(t) || !isSafeImageUrl(t)) throw new Error("imageUrl must be an https:// link to an image");
  return t;
}

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
          "",
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
        p.images?.[0] ?? "",
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
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };

  // Undo the apostrophe the export adds in front of formula-like text.
  const records = csvToRecords(csvText).map((rec) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, unescapeFormulaCell(v)])));
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
            select: { id: true, productId: true, quantity: true, autoUnpublished: true, lowStockThreshold: true, sku: true, barcode: true, price: true, costPrice: true, isActive: true, updatedAt: true },
          });
          if (!variant) throw new Error("variantId not found in this store");
          const vSku = r.sku?.trim() || null;
          const vBarcode = r.barcode?.trim() || null;
          if ((vSku && vSku !== variant.sku) || (vBarcode && vBarcode !== variant.barcode)) {
            const clash = await findIdentifierClash(access.store.id, { sku: vSku !== variant.sku ? vSku : null, barcode: vBarcode !== variant.barcode ? vBarcode : null }, { variantId: variant.id, productId: variant.productId });
            if (clash) throw new Error(`${clash.field === "sku" ? "SKU" : "barcode"} is already in use`);
          }

          const quantity = parseNum(r.quantity ?? "");
          // Same bounds the product editor enforces. Without them a variant row could store
          // a negative or absurd price, a negative cost, or overflow the quantity column.
          const vPrice = parseNum(r.price ?? "");
          if (vPrice != null && (vPrice <= 0 || vPrice > MAX_PRICE)) throw new Error("price must be greater than 0 and not absurdly large");
          const vCost = parseNum(r.costPrice ?? "");
          if (vCost != null && (vCost < 0 || vCost > MAX_PRICE)) throw new Error("costPrice must be between 0 and 999,999,999");
          const vThreshold = parseNum(r.lowStockThreshold ?? "");
          if (vThreshold != null && (!Number.isInteger(vThreshold) || vThreshold < 0 || vThreshold > MAX_QUANTITY)) throw new Error("lowStockThreshold must be a whole number, 0 or more");
          if (quantity != null && (quantity < 0 || quantity > MAX_QUANTITY)) throw new Error("quantity must be between 0 and 1,000,000");
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
          const nextCostPrice = r.costPrice?.trim() === "" ? variant.costPrice : (parseNum(r.costPrice ?? "") != null ? roundMoney(parseNum(r.costPrice)!) : variant.costPrice);
          const updated = await tx.productVariant.updateMany({
            where: { id: variant.id, storeId: access.store.id, updatedAt: variant.updatedAt },
            data: {
              sku: r.sku?.trim() || variant.sku,
              barcode: r.barcode?.trim() || variant.barcode,
              price: r.price?.trim() === "" ? variant.price : (parseNum(r.price ?? "") != null ? roundMoney(parseNum(r.price)!) : variant.price),
              costPrice: nextCostPrice,
              quantity: nextQuantity,
              lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? variant.lowStockThreshold,
              isActive: parseBool(r.isPublished ?? "", variant.isActive),
              autoUnpublished: justRestocked ? false : variant.autoUnpublished,
            },
          });
          if (updated.count !== 1) throw new Error("INVENTORY_CONFLICT");

          if (delta !== 0) {
            const movement = await tx.stockMovement.create({
              data: {
                variantId: variant.id,
                storeId: access.store.id,
                type: "CORRECTION",
                quantityChange: delta,
                quantityAfter: nextQuantity,
                note: "CSV import",
              },
            });
            await recordBatchLedgerForQuantityChangeTx(tx, { variantId: variant.id, storeId: access.store.id, delta, stockMovementId: movement.id, unitCost: toCost(nextCostPrice), sourceNote: "CSV import" });
          }
          return variant.id;
        }, { isolationLevel: "Serializable", timeout: 15000 });

        summary.updated++;
        summary.rows.push({ row: rowNum, variantId: result, status: "updated" });
        continue;
      }

      let categoryId: string | null | undefined = undefined;
      if (r.category?.trim()) {
        // Product categories only, and a name that doesn't exist is an error: it
        // used to resolve to null and silently clear the product's category.
        const cat = await prisma.category.findFirst({ where: { name: r.category.trim(), storeId: access.store.id, type: "PRODUCT" } });
        if (!cat) throw new Error(`category "${r.category.trim()}" doesn't exist in this store. Create it first or leave the cell blank.`);
        categoryId = cat.id;
      }

      if (r.productId) {
        const result = await prisma.$transaction(async (tx) => {
          const product = await tx.product.findFirst({
            where: { id: r.productId, storeId: access.store.id },
            include: { inventory: true },
          });
          if (!product) throw new Error("productId not found in this store");
          // Variant products sell from per-variant stock; the parent row must never be written.
          if (product.hasVariants) throw new Error("this product uses variants. Update its variant rows (with variantId) instead");
          const pSku = r.sku?.trim() || null;
          const pBarcode = r.barcode?.trim() || null;
          if ((pSku && pSku !== product.inventory?.sku) || (pBarcode && pBarcode !== product.inventory?.barcode)) {
            const clash = await findIdentifierClash(access.store.id, { sku: pSku !== product.inventory?.sku ? pSku : null, barcode: pBarcode !== product.inventory?.barcode ? pBarcode : null }, { productId: product.id });
            if (clash) throw new Error(`${clash.field === "sku" ? "SKU" : "barcode"} is already in use`);
          }
          const rowPrice = parseNum(r.price ?? "");
          if (rowPrice != null && (rowPrice <= 0 || rowPrice > MAX_PRICE)) throw new Error("price must be greater than 0 and not absurdly large");
          const rowCompare = parseNum(r.compareAtPrice ?? "");
          const effectivePrice = rowPrice ?? Number(product.price);
          if (rowCompare != null && rowCompare <= effectivePrice) throw new Error("compareAtPrice must be higher than the price");
          // A new price that reaches the existing compare-at price would leave an invalid pair the editor then rejects.
          if (rowCompare == null && rowPrice != null && product.compareAtPrice != null && Number(product.compareAtPrice) <= rowPrice) {
            throw new Error("price must stay below the existing compareAtPrice. Include a higher compareAtPrice too.");
          }
          const rowImage = parseImageUrl(r.imageUrl);
          const rowQty = parseNum(r.quantity ?? "");
          if (rowQty != null && (rowQty < 0 || rowQty > MAX_QUANTITY)) throw new Error("quantity must be between 0 and 1,000,000");
          const rowCost = parseNum(r.costPrice ?? "");
          if (rowCost != null && (rowCost < 0 || rowCost > MAX_PRICE)) throw new Error("costPrice must be between 0 and 999,999,999");
          const rowThreshold = parseNum(r.lowStockThreshold ?? "");
          if (rowThreshold != null && (!Number.isInteger(rowThreshold) || rowThreshold < 0 || rowThreshold > MAX_QUANTITY)) throw new Error("lowStockThreshold must be a whole number, 0 or more");

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

          // Publish state is decided once, here, and written once at the end. The CSV's
          // isPublished column only counts as the merchant's choice when it differs from the
          // product's current state: an exported row always carries the state at export time,
          // and that stale echo must not override the out-of-stock automation.
          const csvPublishValue = parseBool(r.isPublished ?? "", product.isPublished);
          const csvChangedPublish = (r.isPublished ?? "").trim() !== "" && csvPublishValue !== product.isPublished;
          let finalPublished = csvChangedPublish ? csvPublishValue : product.isPublished;

          if (product.inventory) {
            const decision = decidePublishAfterStockChange({
              wasPublished: product.isPublished,
              explicitPublish: csvChangedPublish,
              requestedPublished: csvPublishValue,
              prevQuantity: product.inventory.quantity,
              nextQuantity,
              wasAutoUnpublished: product.inventory.autoUnpublished,
            });
            finalPublished = decision.isPublished;
            const { quantity: _q, ...inventoryFields } = inventoryData;
            await correctInventoryQuantityTx(tx, {
              storeId: access.store.id,
              inventoryItemId: product.inventory.id,
              currentQuantity: product.inventory.quantity,
              nextQuantity,
              // CSV rows carry the export-time timestamp; always guard on the row we read.
              guard: { updatedAt: product.inventory.updatedAt },
              autoUnpublished: decision.autoUnpublished,
              note: "CSV import",
              unitCost: toCost(inventoryData.costPrice),
              extra: inventoryFields,
            });
          } else {
            const createdInventory = await tx.inventoryItem.create({ data: { productId: product.id, storeId: access.store.id, ...inventoryData } });
            if (nextQuantity > 0) {
              await tx.stockMovement.create({
                data: {
                  inventoryItemId: createdInventory.id,
                  storeId: access.store.id,
                  type: "RESTOCK",
                  quantityChange: nextQuantity,
                  quantityAfter: nextQuantity,
                  note: "CSV import initial stock",
                },
              });
              await createFifoBatchTx(tx, { inventoryItemId: createdInventory.id, storeId: access.store.id, quantity: nextQuantity, unitCost: toCost(inventoryData.costPrice), sourceNote: "CSV import initial stock" });
            }
          }

          // Publishing an archived product restores it, which takes a plan slot again.
          if (product.archivedAt && finalPublished) {
            const limit = await assertUnderPlanLimit(access.store.id, "products", tx);
            if (!limit.allowed) throw new Error(`PLAN_LIMIT:${limit.error}`);
          }
          await tx.product.update({
            where: { id: product.id },
            data: {
              ...(categoryId !== undefined ? { categoryId } : {}),
              price: rowPrice != null ? roundMoney(rowPrice) : product.price,
              ...(rowCompare != null ? { compareAtPrice: roundMoney(rowCompare) } : {}),
              // A new picture replaces the main image and keeps any other photos.
              ...(rowImage && rowImage !== product.images?.[0] ? { images: [rowImage, ...(product.images ?? []).filter((u: string) => u !== rowImage).slice(0, 11)] } : {}),
              isPublished: finalPublished,
              ...(finalPublished ? { archivedAt: null } : {}),
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
      const newName = r.name?.trim() ?? "";
      if (newName.length < 2 || newName.length > 120) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "name is required (2 to 120 characters) to create a new product" });
        continue;
      }
      const price = parseNum(r.price ?? "");
      if (price == null || price <= 0 || price > MAX_PRICE) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "a positive price (under 999,999,999) is required to create a new product" });
        continue;
      }
      const compareAt = parseNum(r.compareAtPrice ?? "");
      if (compareAt != null && compareAt <= price) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "compareAtPrice must be higher than the price" });
        continue;
      }

      const quantity = parseNum(r.quantity ?? "") ?? 0;
      if (quantity < 0 || quantity > MAX_QUANTITY) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "quantity must be between 0 and 1,000,000" });
        continue;
      }
      const costPrice = parseNum(r.costPrice ?? "");
      if (costPrice != null && (costPrice < 0 || costPrice > MAX_PRICE)) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "costPrice must be between 0 and 999,999,999" });
        continue;
      }
      const newThreshold = parseNum(r.lowStockThreshold ?? "");
      if (newThreshold != null && (!Number.isInteger(newThreshold) || newThreshold < 0 || newThreshold > MAX_QUANTITY)) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: "lowStockThreshold must be a whole number, 0 or more" });
        continue;
      }
      const newImage = parseImageUrl(r.imageUrl);
      const newSku = r.sku?.trim() || null;
      const newBarcode = r.barcode?.trim() || null;
      const newClash = await findIdentifierClash(access.store.id, { sku: newSku, barcode: newBarcode });
      if (newClash) {
        summary.errors++;
        summary.rows.push({ row: rowNum, status: "error", message: `${newClash.field === "sku" ? "SKU" : "barcode"} is already in use` });
        continue;
      }
      const baseSlug = slugify(newName, { lower: true, strict: true }) || "item";
      let productSlug = baseSlug;
      let suffix = 1;
      while (await prisma.product.findUnique({ where: { storeId_slug: { storeId: access.store.id, slug: productSlug } } })) {
        suffix += 1;
        productSlug = `${baseSlug}-${suffix}`;
      }

      let created: string | null = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        try {
          created = await prisma.$transaction(async (tx) => {
            // Re-checked inside the Serializable transaction (as createProduct does) so
            // concurrent creates can't both pass the plan limit.
            const limit = await assertUnderPlanLimit(access.store.id, "products", tx);
            if (!limit.allowed) throw new Error(`PLAN_LIMIT:${limit.error}`);
            const product = await tx.product.create({
              data: {
                storeId: access.store.id,
                categoryId: categoryId || null,
                type: "PHYSICAL",
                name: newName,
                slug: productSlug,
                description: newName.length >= 10 ? newName : `${newName} (imported item)`,
                price: roundMoney(price),
                compareAtPrice: compareAt != null ? roundMoney(compareAt) : null,
                currency: access.store.currency,
                images: newImage ? [newImage] : [],
                isPublished: parseBool(r.isPublished ?? "", true),
                inventory: {
                  create: {
                    storeId: access.store.id,
                    sku: newSku,
                    barcode: newBarcode,
                    quantity: Math.max(0, Math.round(quantity)),
                    costPrice: costPrice != null ? roundMoney(costPrice) : null,
                    lowStockThreshold: parseNum(r.lowStockThreshold ?? "") ?? 5,
                  },
                },
              },
              include: { inventory: true },
            });
            const initialQty = Math.max(0, Math.round(quantity));
            if (initialQty > 0 && product.inventory) {
              await tx.stockMovement.create({
                data: {
                  inventoryItemId: product.inventory.id,
                  storeId: access.store.id,
                  type: "RESTOCK",
                  quantityChange: initialQty,
                  quantityAfter: initialQty,
                  note: "CSV import initial stock",
                },
              });
              await createFifoBatchTx(tx, { inventoryItemId: product.inventory.id, storeId: access.store.id, quantity: initialQty, unitCost: toCost(product.inventory.costPrice), sourceNote: "CSV import initial stock" });
            }
            return product.id;
          }, { isolationLevel: "Serializable", timeout: 15000 });
        } catch (err: any) {
          // Another request took the slug between the check and the insert: pick the next one.
          if (err?.code === "P2002" && String(err?.meta?.target ?? "").includes("slug") && attempt < 4) {
            suffix += 1;
            productSlug = `${baseSlug}-${suffix}`;
            continue;
          }
          if (err?.code === "P2034" && attempt < 4) continue;
          throw err;
        }
      }
      if (!created) throw new Error("Couldn't create the product. Please try again.");

      summary.created++;
      summary.rows.push({ row: rowNum, productId: created, status: "created" });
    } catch (err) {
      summary.errors++;
      const code = (err as { code?: string } | null)?.code;
      const target = String((err as { meta?: { target?: unknown } } | null)?.meta?.target ?? "");
      let message = err instanceof Error ? err.message : "Unknown error";
      if (message === "INVENTORY_CONFLICT") message = "Inventory changed since this CSV was exported. Re-export the products and try again.";
      else if (message.startsWith("PLAN_LIMIT:")) message = message.slice("PLAN_LIMIT:".length);
      else if (code === "P2002") message = target.includes("barcode") ? "barcode is already in use" : target.includes("sku") ? "SKU is already in use" : "a duplicate value was rejected";
      else if (code === "P2034") message = "This row conflicted with another change. Import it again.";
      else if (code) message = "Couldn't save this row. Check the values and try again.";
      summary.rows.push({ row: rowNum, status: "error", message });
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
  // Quantity the editor saw when the page loaded. Required with `quantity`:
  // the server compares it with live stock so a stale absolute value can't
  // overwrite a sale, restock or refund that happened in between.
  expectedQuantity?: number;
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
  const access = await assertMenuEditor(slug);
  if (!access.success) return { success: false, error: access.error };
  if (patches.length === 0) return { success: false, error: "Nothing selected." };
  if (patches.length > 500) return { success: false, error: "Bulk edit is limited to 500 products at a time." };

  const ids = patches.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, storeId: access.store.id },
    include: { inventory: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Collected inside the transaction, reported (audit log + webhooks) only after it commits.
  const changes: { id: string; name: string; price?: { from: number; to: number }; isPublished?: { from: boolean; to: boolean }; quantity?: { change: number; after: number } }[] = [];

  let updated = 0;
  try {
    await prisma.$transaction(async (tx) => {
    for (const patch of patches) {
      const product = byId.get(patch.productId);
      if (!product) throw new Error("One of the selected products no longer exists. Refresh the page.");

      const productData: Record<string, unknown> = {};
      const change: (typeof changes)[number] = { id: product.id, name: product.name };

      if (patch.price != null && patch.price > 0) {
        if (patch.price > MAX_PRICE) throw new Error(`${product.name}: price is too large.`);
        const nextPrice = roundMoney(patch.price);
        if (product.compareAtPrice != null && Number(product.compareAtPrice) <= nextPrice) {
          throw new Error(`${product.name}: price must stay below its compare-at price (${Number(product.compareAtPrice)}). Edit the product to change both.`);
        }
        productData.price = nextPrice;
        if (Number(product.price) !== nextPrice) change.price = { from: Number(product.price), to: nextPrice };
      }
      if (patch.categoryId !== undefined) {
        if (patch.categoryId) {
          // Only categories that belong to this store (and hold products) can be assigned.
          const cat = await tx.category.findFirst({ where: { id: patch.categoryId, storeId: access.store.id, type: "PRODUCT" }, select: { id: true } });
          if (!cat) throw new Error("Choose a product category from this store.");
        }
        productData.categoryId = patch.categoryId;
      }

      // Publish state is decided once and written once. An explicit publish/unpublish in the
      // patch is the merchant's choice; the shared out-of-stock rule only overrides it when
      // stock actually crosses zero, same as updateProduct and CSV import.
      const explicitPublish = patch.isPublished !== undefined;
      let finalPublished = explicitPublish ? (patch.isPublished as boolean) : product.isPublished;

      if (patch.quantity != null) {
        const nextQuantity = Math.max(0, Math.round(patch.quantity));

        // Variant products sell from per-variant stock; their parent quantity is never written.
        // Checked before looking at the parent inventory row so it can't be skipped silently.
        if (product.hasVariants) {
          throw new Error(`VARIANT_STOCK:${product.name}`);
        }
        if (!product.inventory) throw new Error(`NO_INVENTORY:${product.name}`);
        // Bulk quantity edits are absolute values, so applying a stale value
        // would overwrite stock changed since the user loaded the page (sale,
        // restock, refund, another edit). The baseline must come from the
        // client's page-load snapshot -- re-reading inside this request only
        // compares the database with itself and can never detect staleness.
        if (typeof patch.expectedQuantity !== "number" || !Number.isInteger(patch.expectedQuantity)) {
          throw new Error("MISSING_BASELINE");
        }
        const currentInventory = await tx.inventoryItem.findFirst({
          where: { id: product.inventory.id, storeId: access.store.id },
          select: { id: true, quantity: true, autoUnpublished: true },
        });
        if (!currentInventory) throw new Error("Inventory item not found.");
        if (currentInventory.quantity !== patch.expectedQuantity) {
          throw new Error(`INVENTORY_CONFLICT:${product.id}`);
        }

        if (nextQuantity !== currentInventory.quantity) {
          const decision = decidePublishAfterStockChange({
            wasPublished: product.isPublished,
            explicitPublish,
            requestedPublished: finalPublished,
            prevQuantity: currentInventory.quantity,
            nextQuantity,
            wasAutoUnpublished: currentInventory.autoUnpublished,
          });
          try {
            const { delta } = await correctInventoryQuantityTx(tx, {
              storeId: access.store.id,
              inventoryItemId: currentInventory.id,
              currentQuantity: currentInventory.quantity,
              nextQuantity,
              guard: { quantity: currentInventory.quantity },
              autoUnpublished: decision.autoUnpublished,
              note: "Bulk edit",
              unitCost: toCost(product.inventory.costPrice),
            });
            change.quantity = { change: delta, after: nextQuantity };
          } catch (err) {
            if (err instanceof Error && err.message === "INVENTORY_CONFLICT") throw new Error(`INVENTORY_CONFLICT:${product.id}`);
            throw err;
          }
          finalPublished = decision.isPublished;
        }
      }

      if (finalPublished !== product.isPublished) {
        productData.isPublished = finalPublished;
        // Publishing an archived product restores it, which takes a plan slot again.
        if (finalPublished) {
          productData.archivedAt = null;
          if (product.archivedAt) {
            const limit = await assertUnderPlanLimit(access.store.id, "products", tx);
            if (!limit.allowed) throw new Error(`PLAN_LIMIT:${limit.error}`);
          }
        }
        change.isPublished = { from: product.isPublished, to: finalPublished };
      }
      if (Object.keys(productData).length > 0) {
        await tx.product.update({ where: { id: product.id }, data: productData });
      }
      if (change.price || change.isPublished || change.quantity || patch.categoryId !== undefined) changes.push(change);
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
    if (err?.message?.startsWith("VARIANT_STOCK:")) {
      return { success: false, error: `${err.message.slice("VARIANT_STOCK:".length)} uses variant stock. Change its quantities from the Variants page.` };
    }
    if (err?.message?.startsWith("NO_INVENTORY:")) {
      return { success: false, error: `${err.message.slice("NO_INVENTORY:".length)} has no stock record yet. Set its stock from the product page first.` };
    }
    if (typeof err?.message === "string" && err.message.startsWith("PLAN_LIMIT:")) {
      return { success: false, error: err.message.slice("PLAN_LIMIT:".length) };
    }
    if (err?.message === "MISSING_BASELINE") {
      return { success: false, error: "Refresh the products page and try the bulk edit again." };
    }
    return { success: false, error: err instanceof Error ? err.message : "Couldn't update products safely." };
  }

  // Audit trail and webhooks, after commit (best-effort inside reportCatalogChange).
  for (const c of changes) {
    await reportCatalogChange(access.store.id, {
      action: "product.updated",
      target: c.name,
      metadata: { productId: c.id, bulk: true, ...(c.price ? { price: c.price } : {}), ...(c.isPublished ? { isPublished: c.isPublished } : {}), ...(c.quantity ? { quantity: c.quantity } : {}) },
      webhook: { event: "PRODUCT_UPDATED", payload: { productId: c.id, name: c.name, ...(c.price ? { price: c.price.to } : {}), ...(c.isPublished ? { isPublished: c.isPublished.to } : {}) } },
    });
  }

  revalidatePath(`/store/${slug}/admin/products`);
  revalidatePath(`/store/${slug}/admin/inventory`);
  return { success: true, data: { updated } };
}
