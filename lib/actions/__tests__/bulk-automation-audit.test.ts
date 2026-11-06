import { beforeEach, describe, expect, it, vi } from "vitest";

// Bulk edit must behave like updateProduct / CSV import: stock crossing zero
// flips the listing, and every change is audit-logged and sent to webhooks.

const state = { live: 5, autoUnpublished: false, isPublished: true, role: "OWNER" };
const invUpdateMany = vi.fn(async () => ({ count: 1 }));
const productUpdate = vi.fn();

const tx = () => ({
  product: { update: (...a: unknown[]) => productUpdate(...a) },
  category: { findFirst: vi.fn(async () => null) },
  inventoryItem: {
    findFirst: vi.fn(async () => ({ id: "i1", quantity: state.live, autoUnpublished: state.autoUnpublished })),
    updateMany: (...a: Parameters<typeof invUpdateMany>) => invUpdateMany(...a),
  },
  stockMovement: { create: vi.fn(async () => ({ id: "m1" })) },
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn(async () => [{ id: "p1", name: "Tote", price: 100, hasVariants: false, isPublished: state.isPublished, inventory: { id: "i1", quantity: state.live, costPrice: null, autoUnpublished: state.autoUnpublished } }]) },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx())),
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: state.role, store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/entitlements", () => ({ assertUnderPlanLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/inventory-fifo", () => ({ createFifoBatchTx: vi.fn(), recordBatchLedgerForQuantityChangeTx: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1", name: "Owner", email: "o@x.com", role: "USER" } })) }));
vi.mock("@/lib/activity-log", () => ({ logStoreActivity: vi.fn() }));
vi.mock("@/lib/webhooks/dispatch", () => ({ emitWebhookEvent: vi.fn() }));
vi.mock("@/lib/catalog-identifiers", () => ({ findIdentifierClash: vi.fn(async () => null) }));

import { bulkUpdateProducts } from "@/lib/actions/bulk";
import { logStoreActivity } from "@/lib/activity-log";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { live: 5, autoUnpublished: false, isPublished: true, role: "OWNER" });
  invUpdateMany.mockResolvedValue({ count: 1 });
});

describe("bulkUpdateProducts automation and audit", () => {
  it("unpublishes and flags autoUnpublished when stock reaches zero", async () => {
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", quantity: 0, expectedQuantity: 5 }]);
    expect(r.success).toBe(true);
    expect(invUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: 0, autoUnpublished: true }) }));
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPublished: false }) }));
  });

  it("republishes on restock only when the automation took it down", async () => {
    Object.assign(state, { live: 0, autoUnpublished: true, isPublished: false });
    await bulkUpdateProducts("shop", [{ productId: "p1", quantity: 4, expectedQuantity: 0 }]);
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPublished: true }) }));
  });

  it("leaves a merchant-hidden product hidden on restock", async () => {
    Object.assign(state, { live: 0, autoUnpublished: false, isPublished: false });
    await bulkUpdateProducts("shop", [{ productId: "p1", quantity: 4, expectedQuantity: 0 }]);
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it("audit-logs and emits a webhook for a publish toggle", async () => {
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", isPublished: false }]);
    expect(r.success).toBe(true);
    expect(logStoreActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "product.updated", metadata: expect.objectContaining({ bulk: true, isPublished: { from: true, to: false } }) }));
    expect(emitWebhookEvent).toHaveBeenCalledWith("PRODUCT_UPDATED", "s1", expect.objectContaining({ productId: "p1", isPublished: false }));
  });

  it("lets STAFF with the products permission use bulk edit, like product.ts", async () => {
    state.role = "STAFF";
    const r = await bulkUpdateProducts("shop", [{ productId: "p1", isPublished: false }]);
    expect(r.success).toBe(true);
  });
});
