import { beforeEach, describe, expect, it, vi } from "vitest";

// CSV import must reject what the product form would reject, and must never
// clear a category on a typo or write parent stock on a variant product.

const s = { hasVariants: false, category: null as null | { id: string }, clash: null as null | { field: "sku" | "barcode" } };
const productUpdate = vi.fn();
const productCreate = vi.fn(async () => ({ id: "new1", inventory: null }));

const tx = () => ({
  product: {
    findFirst: vi.fn(async () => ({ id: "p1", price: 100, isPublished: true, hasVariants: s.hasVariants, inventory: { id: "i1", quantity: 5, autoUnpublished: false, sku: "OLD", barcode: null, costPrice: null, lowStockThreshold: 5, updatedAt: new Date("2026-01-01") } })),
    update: (...a: unknown[]) => productUpdate(...a),
    create: (...a: Parameters<typeof productCreate>) => productCreate(...a),
  },
  inventoryItem: { updateMany: vi.fn(async () => ({ count: 1 })) },
  stockMovement: { create: vi.fn(async () => ({ id: "m1" })) },
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findFirst: vi.fn(async () => s.category) },
    product: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx())),
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop", currency: "NGN" } })),
}));
vi.mock("@/lib/entitlements", () => ({ assertUnderPlanLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/inventory-fifo", () => ({ createFifoBatchTx: vi.fn(), recordBatchLedgerForQuantityChangeTx: vi.fn() }));
vi.mock("@/lib/catalog-identifiers", () => ({ findIdentifierClash: vi.fn(async () => s.clash) }));

import { importProductsCsv } from "@/lib/actions/bulk";

const H = "productId,variantId,name,variant,sku,barcode,category,price,compareAtPrice,currency,quantity,costPrice,lowStockThreshold,isPublished,inventoryUpdatedAt";
const msg = async (line: string) => {
  const r = await importProductsCsv("shop", `${H}\n${line}`);
  if (!r.success) throw new Error(r.error);
  return r.data.rows[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(s, { hasVariants: false, category: null, clash: null });
});

describe("importProductsCsv validation", () => {
  it("errors on an unknown category instead of clearing the product's category", async () => {
    const row = await msg("p1,,Tote,,,,Typo cat,,,NGN,,,,,");
    expect(row.status).toBe("error");
    expect(row.message).toMatch(/category/);
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it("refuses to write a variant product's parent row", async () => {
    s.hasVariants = true;
    const row = await msg("p1,,Tote,,,,,150,,NGN,9,,,,");
    expect(row.status).toBe("error");
    expect(row.message).toMatch(/variant/);
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it("rejects a SKU already used elsewhere in the store", async () => {
    s.clash = { field: "sku" };
    const row = await msg("p1,,Tote,,NEWSKU,,,,,NGN,,,,,");
    expect(row).toMatchObject({ status: "error", message: "SKU is already in use" });
  });

  it("imports compareAtPrice on update and rejects one not above the price", async () => {
    const ok = await msg("p1,,Tote,,,,,100,150,NGN,,,,,");
    expect(ok.status).toBe("updated");
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ compareAtPrice: 150 }) }));
    const bad = await msg("p1,,Tote,,,,,100,90,NGN,,,,,");
    expect(bad).toMatchObject({ status: "error" });
  });

  it("rejects absurd prices and quantities on create", async () => {
    expect((await msg(",,Widget,,,,,9999999999,,NGN,1,,,,")).status).toBe("error");
    expect((await msg(",,Widget,,,,,10,,NGN,99999999,,,,")).status).toBe("error");
    expect(productCreate).not.toHaveBeenCalled();
  });

  it("creates a valid row with compareAtPrice stored", async () => {
    const row = await msg(",,Widget,,,,,100,150,NGN,2,,,,");
    expect(row.status).toBe("created");
    expect(productCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ compareAtPrice: 150 }) }));
  });
});
