import { beforeEach, describe, expect, it, vi } from "vitest";

// Behavioral test: bulk quantity edits compare against the client's
// page-load baseline (expectedQuantity), not a re-read of the database.

const state = { live: 7, hasVariants: false };
const invUpdateMany = vi.fn();
const movementCreate = vi.fn();

const tx = () => ({
  product: { update: vi.fn() },
  inventoryItem: {
    findFirst: vi.fn(async () => ({ id: "i1", quantity: state.live })),
    updateMany: (...a: unknown[]) => invUpdateMany(...a),
  },
  stockMovement: { create: (...a: unknown[]) => { movementCreate(...a); return { id: "m1" }; } },
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    // Snapshot read by the action itself: always equals live stock.
    product: { findMany: vi.fn(async () => [{ id: "p1", name: "Tote", hasVariants: state.hasVariants, inventory: { id: "i1", quantity: state.live, costPrice: null } }]) },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx())),
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/entitlements", () => ({ assertUnderPlanLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/inventory-fifo", () => ({ createFifoBatchTx: vi.fn(), recordBatchLedgerForQuantityChangeTx: vi.fn() }));

import { bulkUpdateProducts } from "@/lib/actions/bulk";

beforeEach(() => {
  vi.clearAllMocks();
  state.live = 7;
  state.hasVariants = false;
  invUpdateMany.mockResolvedValue({ count: 1 });
});

describe("bulkUpdateProducts stale quantity protection", () => {
  it("rejects when the page-load baseline no longer matches live stock", async () => {
    // Page loaded at 10; 3 sold since, live = 7.
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", quantity: 20, expectedQuantity: 10 }]);
    expect(r.success).toBe(false);
    expect(invUpdateMany).not.toHaveBeenCalled();
    expect(movementCreate).not.toHaveBeenCalled();
  });

  it("applies the change when the baseline matches", async () => {
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", quantity: 20, expectedQuantity: 7 }]);
    expect(r).toEqual({ success: true, data: { updated: 1 } });
    expect(movementCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ quantityChange: 13, quantityAfter: 20 }) });
  });

  it("refuses a quantity patch with no baseline", async () => {
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", quantity: 20 }]);
    expect(r.success).toBe(false);
    expect(invUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses quantity edits on variant products instead of writing parent stock", async () => {
    state.hasVariants = true;
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", quantity: 20, expectedQuantity: 7 }]);
    expect(r.success).toBe(false);
    expect(invUpdateMany).not.toHaveBeenCalled();
  });

  it("still allows non-quantity patches (publish toggle) without a baseline", async () => {
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", isPublished: false }]);
    expect(r).toEqual({ success: true, data: { updated: 1 } });
  });
});
