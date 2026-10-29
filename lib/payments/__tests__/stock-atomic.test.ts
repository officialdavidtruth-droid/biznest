import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/business-identity", () => ({ getCanonicalBusinessType: () => "Retail" }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/fnb-settings", () => ({ getFnbRotationMode: () => "FIFO" }));
vi.mock("@/lib/fnb-recipe-stock", () => ({ consumeRecipeIngredientsTx: async () => ({ handled: false, shortfalls: [] }) }));

import { decrementStockForOrder } from "../stock";

type Row = { id: string; quantity: number; autoUnpublished: boolean; costPrice: null; label?: string };

function makeWorld(opts: { stock: number; items: { productId?: string; variantId?: string; quantity: number }[]; variant?: boolean }) {
  const row: Row = { id: "stock1", quantity: opts.stock, autoUnpublished: false, costPrice: null, label: "M / Blue" };
  const world = {
    row,
    published: true,
    movements: [] as any[],
    batches: [{ id: "b0", quantityRemaining: opts.stock, receivedAt: new Date(2026, 0, 1), expiryDate: null as Date | null, unitCost: null }] as any[],
    consumptions: [] as any[],
    /** runs once, right before the first guarded UPDATE: simulates another order committing first */
    raceBeforeFirstDecrement: null as null | (() => void),
  };
  const model = (isVariant: boolean) => ({
    findFirst: async () => ({ ...row }),
    update: async ({ data }: any) => { Object.assign(row, data); return row; },
    updateMany: async ({ where, data }: any) => {
      if (world.raceBeforeFirstDecrement) { const f = world.raceBeforeFirstDecrement; world.raceBeforeFirstDecrement = null; f(); }
      if (where.quantity?.gte != null && row.quantity < where.quantity.gte) return { count: 0 };
      if (data.quantity?.decrement != null) row.quantity -= data.quantity.decrement;
      return { count: 1 };
    },
  });
  const tx: any = {
    order: { findUnique: async () => ({ id: "o1", storeId: "s1", items: opts.items, store: { businessType: "Retail", enabledModules: [], business: { category: "Retail" } } }) },
    stockMovement: {
      findFirst: async ({ where }: any) => world.movements.find((m) => m.orderId === where.orderId && m.type === where.type) ?? null,
      create: async ({ data }: any) => { const m = { id: `m${world.movements.length + 1}`, ...data }; world.movements.push(m); return m; },
    },
    inventoryItem: model(false),
    productVariant: { ...model(true), findFirst: async (args: any) => (args?.select?.productId ? { productId: "p1" } : { ...row }) },
    product: { findFirst: async () => null, update: async ({ data }: any) => { if ("isPublished" in data) world.published = data.isPublished; } },
    inventoryBatch: {
      findMany: async () => world.batches.filter((b) => b.quantityRemaining > 0),
      create: async ({ data }: any) => { const b = { id: `ob${world.batches.length}`, expiryDate: null, ...data }; world.batches.push(b); return b; },
      update: async ({ where, data }: any) => { world.batches.find((b) => b.id === where.id)!.quantityRemaining -= data.quantityRemaining.decrement; },
    },
    inventoryBatchConsumption: { create: async ({ data }: any) => { world.consumptions.push(data); } },
  };
  return { world, tx };
}

const batched = (w: ReturnType<typeof makeWorld>["world"]) => w.batches.reduce((s, b) => s + b.quantityRemaining, 0);
const plain = (q: number) => [{ productId: "p1", quantity: q }];

describe("decrementStockForOrder (paid orders)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sells the last unit and keeps stock, ledger and batches in agreement", async () => {
    const { world, tx } = makeWorld({ stock: 1, items: plain(1) });
    await decrementStockForOrder(tx, "o1", { allowOversell: true });
    expect(world.row.quantity).toBe(0);
    expect(world.movements[0]).toMatchObject({ type: "SALE", quantityChange: -1, quantityAfter: 0, orderId: "o1" });
    expect(batched(world)).toBe(0);
    expect(world.published).toBe(false);
    expect(world.row.autoUnpublished).toBe(true);
  });

  it("takes what exists and notes the oversold quantity instead of failing a paid order", async () => {
    const { world, tx } = makeWorld({ stock: 2, items: plain(5) });
    await decrementStockForOrder(tx, "o1", { allowOversell: true });
    expect(world.row.quantity).toBe(0);
    expect(world.movements[0]).toMatchObject({ quantityChange: -2, quantityAfter: 0 });
    expect(world.movements[0].note).toMatch(/OVERSOLD by 3/);
  });

  it("does not lose a concurrent sale: a competing decrement committed first is respected", async () => {
    const { world, tx } = makeWorld({ stock: 10, items: plain(3) });
    // another order sells 6 between our read and our update
    world.raceBeforeFirstDecrement = () => { world.row.quantity = 4; };
    await decrementStockForOrder(tx, "o1", { allowOversell: true });
    expect(world.row.quantity).toBe(1);                      // 4 - 3, not the stale 10 - 3 = 7
    expect(world.movements[0]).toMatchObject({ quantityChange: -3, quantityAfter: 1 });
  });

  it("re-reads after a lost race and only takes what is left (paid order, becomes oversold)", async () => {
    const { world, tx } = makeWorld({ stock: 10, items: plain(3) });
    world.raceBeforeFirstDecrement = () => { world.row.quantity = 2; };
    await decrementStockForOrder(tx, "o1", { allowOversell: true });
    expect(world.row.quantity).toBe(0);
    expect(world.movements[0]).toMatchObject({ quantityChange: -2, quantityAfter: 0 });
    expect(world.movements[0].note).toMatch(/OVERSOLD by 1/);
  });

  it("strict mode (no oversell) throws instead of overselling after a lost race", async () => {
    const { world, tx } = makeWorld({ stock: 10, items: plain(3) });
    world.raceBeforeFirstDecrement = () => { world.row.quantity = 2; };
    await expect(decrementStockForOrder(tx, "o1")).rejects.toThrow(/Not enough stock/);
    expect(world.movements).toHaveLength(0);
  });

  it("is replay-safe: a second call for the same order changes nothing", async () => {
    const { world, tx } = makeWorld({ stock: 10, items: plain(3) });
    await decrementStockForOrder(tx, "o1", { allowOversell: true });
    await decrementStockForOrder(tx, "o1", { allowOversell: true });
    expect(world.row.quantity).toBe(7);
    expect(world.movements).toHaveLength(1);
  });

  it("handles variant lines the same way", async () => {
    const { world, tx } = makeWorld({ stock: 4, items: [{ variantId: "v1", quantity: 4 }] });
    await decrementStockForOrder(tx, "o1", { allowOversell: true });
    expect(world.row.quantity).toBe(0);
    expect(world.movements[0]).toMatchObject({ variantId: "stock1", quantityChange: -4, quantityAfter: 0 });
    expect(batched(world)).toBe(0);
  });
});
