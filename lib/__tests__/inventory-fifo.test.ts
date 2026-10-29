import { describe, expect, it } from "vitest";
import { consumeFifoStockTx, consumeFefoStockTx, recordBatchLedgerForQuantityChangeTx } from "../inventory-fifo";

type Batch = { id: string; quantityRemaining: number; receivedAt: Date; expiryDate: Date | null; unitCost: null };

/**
 * In-memory tx. Callers decrement stored quantity BEFORE consuming (see the
 * contract in inventory-fifo.ts), so `afterQty` is the post-decrement balance.
 */
function makeTx(stockBefore: number, sell: number, batchQtys: number[]) {
  const state = {
    afterQty: stockBefore - sell,
    batches: batchQtys.map((q, i): Batch => ({ id: `b${i}`, quantityRemaining: q, receivedAt: new Date(2026, 0, i + 1), expiryDate: null, unitCost: null })),
    consumptions: [] as { inventoryBatchId: string; quantity: number }[],
  };
  const tx: any = {
    inventoryBatch: {
      findMany: async () => state.batches.filter((b) => b.quantityRemaining > 0),
      create: async ({ data }: any) => { const b = { id: `opening${state.batches.length}`, expiryDate: null, ...data }; state.batches.push(b); return b; },
      update: async ({ where, data }: any) => { state.batches.find((b) => b.id === where.id)!.quantityRemaining -= data.quantityRemaining.decrement; },
    },
    inventoryBatchConsumption: { create: async ({ data }: any) => { state.consumptions.push(data); } },
    inventoryItem: { findFirst: async () => ({ quantity: state.afterQty, costPrice: null }) },
    productVariant: { findFirst: async () => ({ quantity: state.afterQty, costPrice: null }) },
  };
  const batchedTotal = () => state.batches.reduce((s, b) => s + b.quantityRemaining, 0);
  return { tx, state, batchedTotal };
}

const target = { inventoryItemId: "i1", storeId: "s1", stockMovementId: "m1" };

describe.each([["FIFO", consumeFifoStockTx], ["FEFO", consumeFefoStockTx]] as const)("%s consume", (_name, consume) => {
  it.each([[10, 3], [10, 6], [10, 10], [1, 1]])("sells %i-stock x%i and keeps batches equal to stock", async (stock, sell) => {
    const { tx, state, batchedTotal } = makeTx(stock, sell, [stock]);
    await consume(tx, { ...target, quantity: sell });
    expect(batchedTotal()).toBe(state.afterQty);
  });

  it("sizes the legacy opening lot from the pre-sale balance", async () => {
    const { tx, state, batchedTotal } = makeTx(10, 6, []);
    await consume(tx, { ...target, quantity: 6 });
    expect(batchedTotal()).toBe(state.afterQty);
  });

  it("works for variants", async () => {
    const { tx, state, batchedTotal } = makeTx(4, 4, [4]);
    await consume(tx, { variantId: "v1", storeId: "s1", quantity: 4, stockMovementId: "m1" });
    expect(batchedTotal()).toBe(state.afterQty);
  });
});

describe("FIFO ordering", () => {
  it("drains the oldest batch first", async () => {
    const { tx, state } = makeTx(8, 5, [3, 5]);
    await consumeFifoStockTx(tx, { ...target, quantity: 5 });
    expect(state.consumptions).toEqual([{ inventoryBatchId: "b0", stockMovementId: "m1", quantity: 3, unitCost: null }, { inventoryBatchId: "b1", stockMovementId: "m1", quantity: 2, unitCost: null }]);
  });
});

describe("recordBatchLedgerForQuantityChangeTx (product edit / CSV / bulk corrections)", () => {
  it("positive correction creates a receipt lot with the given cost", async () => {
    const { tx, state, batchedTotal } = makeTx(5, 0, [5]);
    state.afterQty = 8; // caller already raised stock 5 -> 8
    await recordBatchLedgerForQuantityChangeTx(tx, { ...target, delta: 3, unitCost: 120, sourceNote: "CSV import" });
    expect(batchedTotal()).toBe(8);
    const lot = state.batches[state.batches.length - 1] as any;
    expect(lot.unitCost).toBe(120);
    expect(lot.quantityReceived).toBe(3);
  });

  it("negative correction consumes oldest lots so batches match stock (no phantom units)", async () => {
    const { tx, state, batchedTotal } = makeTx(10, 0, [4, 6]);
    state.afterQty = 3; // caller already lowered stock 10 -> 3
    await recordBatchLedgerForQuantityChangeTx(tx, { ...target, delta: -7 });
    expect(batchedTotal()).toBe(3);
    expect(state.consumptions.map((c) => [c.inventoryBatchId, c.quantity])).toEqual([["b0", 4], ["b1", 3]]);
  });

  it("zeroing out all stock works", async () => {
    const { tx, state, batchedTotal } = makeTx(5, 0, [5]);
    state.afterQty = 0;
    await recordBatchLedgerForQuantityChangeTx(tx, { ...target, delta: -5 });
    expect(batchedTotal()).toBe(0);
  });

  it("is a no-op for a zero delta and rejects fractions", async () => {
    const { tx, state } = makeTx(5, 0, [5]);
    await recordBatchLedgerForQuantityChangeTx(tx, { ...target, delta: 0 });
    expect(state.batches).toHaveLength(1);
    await expect(recordBatchLedgerForQuantityChangeTx(tx, { ...target, delta: 1.5 })).rejects.toThrow();
  });

  it("works for variants", async () => {
    const { tx, state, batchedTotal } = makeTx(4, 0, [4]);
    state.afterQty = 1;
    await recordBatchLedgerForQuantityChangeTx(tx, { variantId: "v1", storeId: "s1", delta: -3, stockMovementId: "m1" });
    expect(batchedTotal()).toBe(1);
  });
});
