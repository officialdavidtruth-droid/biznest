import { beforeEach, describe, expect, it, vi } from "vitest";

// deleteVariant must never hard-delete a variant that has stock, stock history,
// order lines or purchase-order lines: StockMovement/InventoryBatch cascade from it.

const s = { quantity: 0, orders: 0, pos: 0, movements: 0 };
const variantDelete = vi.fn();
const variantUpdate = vi.fn();

const tx = () => ({
  productVariant: {
    findFirst: vi.fn(async () => ({ quantity: s.quantity })),
    delete: (...a: unknown[]) => variantDelete(...a),
    update: (...a: unknown[]) => variantUpdate(...a),
    count: vi.fn(async () => 1),
  },
  orderItem: { count: vi.fn(async () => s.orders) },
  purchaseOrderItem: { count: vi.fn(async () => s.pos) },
  stockMovement: { count: vi.fn(async () => s.movements) },
  product: { update: vi.fn() },
  inventoryItem: { upsert: vi.fn() },
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productVariant: { findFirst: vi.fn(async () => ({ id: "v1", productId: "p1", label: "M / Blue" })) },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx())),
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("@/lib/activity-log", () => ({ logStoreActivity: vi.fn() }));
vi.mock("@/lib/webhooks/dispatch", () => ({ emitWebhookEvent: vi.fn() }));
vi.mock("@/lib/catalog-identifiers", () => ({ findIdentifierClash: vi.fn(), clashResult: vi.fn() }));
vi.mock("@/lib/inventory-fifo", () => ({ consumeFifoStockTx: vi.fn(), createFifoBatchTx: vi.fn() }));
vi.mock("@prisma/client", () => ({ Prisma: { DbNull: "DbNull" } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteVariant } from "@/lib/actions/variant";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(s, { quantity: 0, orders: 0, pos: 0, movements: 0 });
});

describe("deleteVariant guard", () => {
  it("hard-deletes a variant with no stock and no history", async () => {
    const r = await deleteVariant("shop", "v1");
    expect(r).toEqual({ success: true, data: { archived: false } });
    expect(variantDelete).toHaveBeenCalled();
  });

  for (const [name, patch] of [["live stock", { quantity: 3 }], ["stock history", { movements: 2 }], ["order lines", { orders: 1 }], ["purchase-order lines", { pos: 1 }]] as const) {
    it(`deactivates instead of deleting when it has ${name}`, async () => {
      Object.assign(s, patch);
      const r = await deleteVariant("shop", "v1");
      expect(r).toEqual({ success: true, data: { archived: true } });
      expect(variantDelete).not.toHaveBeenCalled();
      expect(variantUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }));
    });
  }
});
