import { beforeEach, describe, expect, it, vi } from "vitest";

// updateProduct now uses the shared out-of-stock rule: the form's echo of the
// current published flag is not a decision, so a restock republishes what the
// automation took down.

const state = { wasPublished: false, qty: 0, auto: true };
const productUpdate = vi.fn();
const invUpdateMany = vi.fn(async () => ({ count: 1 }));

const makeTx = () => ({
  product: {
    findFirst: vi.fn(async () => ({ id: "p1", hasVariants: false, isPublished: state.wasPublished, inventory: { id: "i1", quantity: state.qty, autoUnpublished: state.auto, costPrice: null } })),
    update: (...a: unknown[]) => productUpdate(...a),
  },
  inventoryItem: { updateMany: (...a: Parameters<typeof invUpdateMany>) => invUpdateMany(...a), findUnique: vi.fn() },
  stockMovement: { create: vi.fn(async () => ({ id: "m1" })) },
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findFirst: vi.fn() },
    product: { findFirst: vi.fn(async () => ({ id: "p1", hasVariants: false, price: 5000, isPublished: state.wasPublished, currency: "NGN" })) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(makeTx())),
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/entitlements", () => ({ assertUnderPlanLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/catalog-identifiers", () => ({ findIdentifierClash: vi.fn(async () => null), clashResult: vi.fn() }));
vi.mock("@/lib/inventory-fifo", () => ({ createFifoBatchTx: vi.fn(), recordBatchLedgerForQuantityChangeTx: vi.fn() }));

import { updateProduct } from "@/lib/actions/product";

const input = (quantity: number, isPublished: boolean) => ({
  name: "Tote bag", type: "PHYSICAL" as const, description: "A sturdy canvas tote bag",
  price: 5000, currency: "NGN", images: [], isPublished, quantity,
});

beforeEach(() => { vi.clearAllMocks(); Object.assign(state, { wasPublished: false, qty: 0, auto: true }); });

describe("updateProduct publish rule", () => {
  it("republishes an automation-unpublished product on restock when the form just echoes the flag", async () => {
    const r = await updateProduct("shop", "p1", input(6, false), { baselineQuantity: 0 });
    expect(r.success).toBe(true);
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPublished: true }) }));
    expect(invUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ autoUnpublished: false }) }));
  });

  it("flags and unpublishes when an edit takes stock to zero", async () => {
    Object.assign(state, { wasPublished: true, qty: 5, auto: false });
    await updateProduct("shop", "p1", input(0, true), { baselineQuantity: 5 });
    expect(invUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: 0, autoUnpublished: true }) }));
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPublished: false }) }));
  });
});
