import { beforeEach, describe, expect, it, vi } from "vitest";

// Behavioral test: CSV import must not let the exported isPublished echo
// override the out-of-stock / restock publish automation.

const state = { published: true, qty: 5, autoUnpublished: false };
const invUpdateMany = vi.fn();
const productUpdate = vi.fn();

const tx = () => ({
  product: {
    findFirst: vi.fn(async () => ({
      id: "p1", price: 100, isPublished: state.published,
      inventory: { id: "i1", quantity: state.qty, autoUnpublished: state.autoUnpublished, sku: null, barcode: null, costPrice: null, lowStockThreshold: 5, updatedAt: new Date("2026-01-01") },
    })),
    update: (...a: unknown[]) => productUpdate(...a),
  },
  inventoryItem: { updateMany: (...a: unknown[]) => { invUpdateMany(...a); return { count: 1 }; } },
  stockMovement: { create: vi.fn(async () => ({ id: "m1" })) },
});

vi.mock("@/lib/prisma", () => ({
  prisma: { category: { findFirst: vi.fn() }, $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx())) },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/entitlements", () => ({ assertUnderPlanLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/inventory-fifo", () => ({ createFifoBatchTx: vi.fn(), recordBatchLedgerForQuantityChangeTx: vi.fn() }));

import { importProductsCsv } from "@/lib/actions/bulk";

const H = "productId,variantId,name,variant,sku,barcode,category,price,compareAtPrice,currency,quantity,costPrice,lowStockThreshold,isPublished,inventoryUpdatedAt";
const row = (quantity: number | "", isPublished: string, price: number | "" = "") =>
  `${H}\np1,,Tote,,,,,${price},,NGN,${quantity},,,${isPublished},`;

const finalPublished = () => productUpdate.mock.calls.at(-1)?.[0]?.data?.isPublished;
const inventoryFlag = () => invUpdateMany.mock.calls.at(-1)?.[0]?.data?.autoUnpublished;

beforeEach(() => {
  vi.clearAllMocks();
  state.published = true; state.qty = 5; state.autoUnpublished = false;
});

describe("importProductsCsv publish automation", () => {
  it("unpublishes and flags a product that runs out, even when the CSV still says published", async () => {
    await importProductsCsv("shop", row(0, "true"));
    expect(finalPublished()).toBe(false);
    expect(inventoryFlag()).toBe(true);
  });

  it("republishes an auto-unpublished product on restock even though the export said false", async () => {
    state.published = false; state.qty = 0; state.autoUnpublished = true;
    await importProductsCsv("shop", row(5, "false"));
    expect(finalPublished()).toBe(true);
    expect(inventoryFlag()).toBe(false);
  });

  it("honors an explicit publish change made in the CSV on restock", async () => {
    state.published = true; state.qty = 0; state.autoUnpublished = true;
    await importProductsCsv("shop", row(5, "false"));
    expect(finalPublished()).toBe(false);
    expect(inventoryFlag()).toBe(false);
  });

  it("does not flag a take-down as automatic when the merchant had already hidden the product", async () => {
    state.published = false; state.qty = 5; state.autoUnpublished = false;
    await importProductsCsv("shop", row(0, "false"));
    expect(finalPublished()).toBe(false);
    expect(inventoryFlag()).toBe(false);
  });

  it("leaves publish state alone on a price-only edit", async () => {
    await importProductsCsv("shop", row(5, "true", 150));
    expect(finalPublished()).toBe(true);
  });
});
