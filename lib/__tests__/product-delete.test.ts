import { beforeEach, describe, expect, it, vi } from "vitest";

const productFindFirst = vi.fn();
const productUpdate = vi.fn();
const productDelete = vi.fn();
const orderItemCount = vi.fn();
const poItemCount = vi.fn();
const movementCount = vi.fn();
const inventoryCount = vi.fn();
const variantCount = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prisma: Record<string, unknown> = {
    product: { findFirst: (...a: unknown[]) => productFindFirst(...a), update: (...a: unknown[]) => productUpdate(...a), delete: (...a: unknown[]) => productDelete(...a) },
    orderItem: { count: (...a: unknown[]) => orderItemCount(...a) },
    purchaseOrderItem: { count: (...a: unknown[]) => poItemCount(...a) },
    stockMovement: { count: (...a: unknown[]) => movementCount(...a) },
    inventoryItem: { count: (...a: unknown[]) => inventoryCount(...a) },
    productVariant: { count: (...a: unknown[]) => variantCount(...a) },
  };
  // The checks and the delete/archive run in one transaction; the mock hands the same tables to it.
  prisma.$transaction = async (fn: (tx: unknown) => unknown) => fn(prisma);
  return { prisma };
});
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
  movementCount.mockResolvedValue(0);
  inventoryCount.mockResolvedValue(0);
  variantCount.mockResolvedValue(0);
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
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: { isPublished: false, archivedAt: expect.any(Date) } });
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

  it("archives instead of deleting when the product has stock history (the ledger would cascade away)", async () => {
    movementCount.mockResolvedValue(3);
    const r = await deleteProduct("shop", "p1");
    expect(r).toEqual({ success: true, data: { archived: true } });
    expect(productDelete).not.toHaveBeenCalled();
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: { isPublished: false, archivedAt: expect.any(Date) } });
  });

  it("archives instead of deleting when units are still on hand", async () => {
    inventoryCount.mockResolvedValue(1);
    const r = await deleteProduct("shop", "p1");
    expect(r).toEqual({ success: true, data: { archived: true } });
    expect(productDelete).not.toHaveBeenCalled();
  });
});
