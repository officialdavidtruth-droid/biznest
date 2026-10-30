import { beforeEach, describe, expect, it, vi } from "vitest";

// Behavioral test: a product edit submitted from a stale form must never
// revert stock that changed (sale / restock) after the form was opened.

const state = { live: 7, hasInventory: true };
const invUpdateMany = vi.fn();
const movementCreate = vi.fn();
const productUpdate = vi.fn();

function makeTx() {
  return {
    product: {
      findFirst: vi.fn(async () => ({
        id: "p1", hasVariants: false,
        inventory: state.hasInventory
          ? { id: "i1", quantity: state.live, autoUnpublished: false, costPrice: null }
          : null,
      })),
      update: (...a: unknown[]) => productUpdate(...a),
    },
    inventoryItem: { updateMany: (...a: unknown[]) => invUpdateMany(...a), findUnique: vi.fn() },
    stockMovement: { create: (...a: unknown[]) => { movementCreate(...a); return { id: "m1" }; } },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findFirst: vi.fn() },
    product: { findFirst: vi.fn(async () => ({ id: "p1", hasVariants: false })) },
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

const input = (quantity: number) => ({
  name: "Tote bag", type: "PHYSICAL" as const, description: "A sturdy canvas tote bag",
  price: 5000, currency: "NGN", images: [], isPublished: true, quantity,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.live = 7;
  state.hasInventory = true;
  invUpdateMany.mockResolvedValue({ count: 1 });
});

describe("updateProduct stale stock protection", () => {
  it("does not touch stock when the quantity field is unchanged from the form baseline", async () => {
    // Form opened at 10, three sold since (live = 7), user only edited the price.
    const r = await updateProduct("shop", "p1", input(10), { baselineQuantity: 10 });
    expect(r.success).toBe(true);
    expect(invUpdateMany).not.toHaveBeenCalled();
    expect(movementCreate).not.toHaveBeenCalled();
  });

  it("rejects a deliberate stock change when live stock moved since the form opened", async () => {
    const r = await updateProduct("shop", "p1", input(20), { baselineQuantity: 10 });
    expect(r.success).toBe(false);
    expect(invUpdateMany).not.toHaveBeenCalled();
    expect(movementCreate).not.toHaveBeenCalled();
  });

  it("applies a deliberate stock change when live stock still matches the baseline", async () => {
    state.live = 10;
    const r = await updateProduct("shop", "p1", input(15), { baselineQuantity: 10 });
    expect(r.success).toBe(true);
    expect(invUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: 15 }) }));
    expect(movementCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ quantityChange: 5, quantityAfter: 15 }) });
  });
});
