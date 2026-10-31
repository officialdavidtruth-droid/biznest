import { describe, expect, it, vi } from "vitest";

const ledger = vi.fn();
vi.mock("@/lib/inventory-fifo", () => ({ recordBatchLedgerForQuantityChangeTx: (...a: unknown[]) => ledger(...a) }));

import { correctInventoryQuantityTx } from "@/lib/catalog/stock";

const mkTx = (count = 1) => {
  const updateMany = vi.fn(async () => ({ count }));
  const create = vi.fn(async () => ({ id: "m1" }));
  return { tx: { inventoryItem: { updateMany }, stockMovement: { create } } as never, updateMany, create };
};
const args = { storeId: "s1", inventoryItemId: "i1", currentQuantity: 5, nextQuantity: 8, guard: { quantity: 5 }, autoUnpublished: false, note: "Bulk edit", unitCost: 12 };

describe("correctInventoryQuantityTx", () => {
  it("guards the update, writes a CORRECTION movement and the batch ledger", async () => {
    const { tx, updateMany, create } = mkTx();
    const r = await correctInventoryQuantityTx(tx, args);
    expect(r.delta).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "i1", storeId: "s1", quantity: 5 }, data: { quantity: 8, autoUnpublished: false } });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "CORRECTION", quantityChange: 3, quantityAfter: 8, note: "Bulk edit" }) });
    expect(ledger).toHaveBeenCalledWith(tx, expect.objectContaining({ delta: 3, unitCost: 12, stockMovementId: "m1" }));
  });

  it("throws INVENTORY_CONFLICT and writes no movement when the guard no longer matches", async () => {
    const { tx, create } = mkTx(0);
    await expect(correctInventoryQuantityTx(tx, args)).rejects.toThrow("INVENTORY_CONFLICT");
    expect(create).not.toHaveBeenCalled();
  });

  it("supports an updatedAt guard (CSV rows)", async () => {
    const at = new Date("2026-01-01");
    const { tx, updateMany } = mkTx();
    await correctInventoryQuantityTx(tx, { ...args, guard: { updatedAt: at } });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "i1", storeId: "s1", updatedAt: at } }));
  });

  it("writes nothing when the quantity is unchanged and no other fields ride along", async () => {
    const { tx, updateMany } = mkTx();
    expect((await correctInventoryQuantityTx(tx, { ...args, nextQuantity: 5 })).delta).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("still applies other fields under the guard, with no movement, when only they change", async () => {
    const { tx, updateMany, create } = mkTx();
    await correctInventoryQuantityTx(tx, { ...args, nextQuantity: 5, extra: { sku: "NEW" } });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sku: "NEW", quantity: 5 }) }));
    expect(create).not.toHaveBeenCalled();
  });
});
