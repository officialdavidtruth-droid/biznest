import { beforeEach, describe, expect, it, vi } from "vitest";

const productFindFirst = vi.fn();
const productUpdate = vi.fn();
const productDelete = vi.fn();
const orderItemCount = vi.fn();
const poItemCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findFirst: (...a: unknown[]) => productFindFirst(...a), update: (...a: unknown[]) => productUpdate(...a), delete: (...a: unknown[]) => productDelete(...a) },
    orderItem: { count: (...a: unknown[]) => orderItemCount(...a) },
    purchaseOrderItem: { count: (...a: unknown[]) => poItemCount(...a) },
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/entitlements", () => ({ assertUnderPlanLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/inventory-fifo", () => ({ createFifoBatchTx: vi.fn(), recordBatchLedgerForQuantityChangeTx: vi.fn() }));

import { deleteProduct } from "@/lib/actions/product";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { logStoreActivity } from "@/lib/activity-log";

beforeEach(() => {
  vi.clearAllMocks();
  productFindFirst.mockResolvedValue({ id: "p1", name: "Tote" });
  orderItemCount.mockResolvedValue(0);
  poItemCount.mockResolvedValue(0);
});

describe("deleteProduct", () => {
  it("hard-deletes a product with no order history and emits product.deleted", async () => {
    const r = await deleteProduct("shop", "p1");
    expect(r).toEqual({ success: true, data: { archived: false } });
    expect(productDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(productUpdate).not.toHaveBeenCalled();
    expect(emitWebhookEvent).toHaveBeenCalledWith("PRODUCT_DELETED", "s1", expect.objectContaining({ productId: "p1" }));
    expect(logStoreActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "product.deleted" }));
  });

  it("unpublishes instead of deleting when orders reference the product", async () => {
    orderItemCount.mockResolvedValue(3);
    const r = await deleteProduct("shop", "p1");
    expect(r).toEqual({ success: true, data: { archived: true } });
    expect(productDelete).not.toHaveBeenCalled();
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: { isPublished: false } });
    expect(emitWebhookEvent).toHaveBeenCalledWith("PRODUCT_UPDATED", "s1", expect.objectContaining({ isPublished: false }));
    expect(logStoreActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "product.archived" }));
  });

  it("also protects products referenced only by purchase orders", async () => {
    poItemCount.mockResolvedValue(1);
    const r = await deleteProduct("shop", "p1");
    expect(r).toEqual({ success: true, data: { archived: true } });
    expect(productDelete).not.toHaveBeenCalled();
  });

  it("returns an error for a product outside the store", async () => {
    productFindFirst.mockResolvedValue(null);
    const r = await deleteProduct("shop", "nope");
    expect(r).toEqual({ success: false, error: "Product not found." });
    expect(productDelete).not.toHaveBeenCalled();
  });
});
