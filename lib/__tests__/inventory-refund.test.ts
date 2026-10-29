import { describe, expect, it } from "vitest";
import { restoreInventoryForRefund } from "../inventory-refund";

type Stock = { id: string; quantity: number; autoUnpublished: boolean; costPrice: number | null; productId?: string };

function makeWorld(opts: {
  items?: Stock[];
  variants?: Stock[];
  movements?: any[];
  orderExists?: boolean;
}) {
  const w = {
    items: opts.items ?? [],
    variants: opts.variants ?? [],
    movements: opts.movements ?? [],
    batches: [] as any[],
    published: new Map<string, boolean>(),
  };
  const matchesSale = (m: any, where: any) =>
    m.storeId === where.storeId && m.type === "SALE" &&
    where.OR.some((c: any) => (c.orderId !== undefined && c.orderId === m.orderId && c.note === undefined) ||
      (c.orderId === null && m.orderId === null && m.note?.includes(c.note.contains)));
  const stockModel = (rows: Stock[]) => ({
    findFirst: async ({ where }: any) => { const r = rows.find((x) => x.id === where.id); return r ? { ...r } : null; },
    update: async ({ where, data }: any) => {
      const r = rows.find((x) => x.id === where.id)!;
      if (data.quantity?.increment != null) r.quantity += data.quantity.increment;
      if (data.autoUnpublished !== undefined) r.autoUnpublished = data.autoUnpublished;
      return { quantity: r.quantity };
    },
  });
  const tx: any = {
    stockMovement: {
      findFirst: async ({ where }: any) => w.movements.find((m) => m.orderId === where.orderId && m.type === where.type) ?? null,
      findMany: async ({ where }: any) => w.movements.filter((m) => matchesSale(m, where)).map((m) => ({ batchConsumptions: [], ...m })),
      create: async ({ data }: any) => { w.movements.push({ id: `r${w.movements.length}`, ...data }); },
    },
    order: { findUnique: async () => (opts.orderExists === false ? null : { id: "o1" }) },
    inventoryItem: stockModel(w.items),
    productVariant: stockModel(w.variants),
    product: { update: async ({ where, data }: any) => { w.published.set(where.id, data.isPublished); } },
    inventoryBatch: { create: async ({ data }: any) => { w.batches.push(data); } },
  };
  return { w, tx };
}

const sale = (extra: any) => ({ storeId: "s1", type: "SALE", orderId: "o1", note: "Online sale (order o1)", batchConsumptions: [], ...extra });
const item = (over: Partial<Stock> = {}): Stock => ({ id: "i1", quantity: 0, autoUnpublished: false, costPrice: 50, productId: "p1", ...over });

describe("restoreInventoryForRefund", () => {
  it("restores exactly what the sale took, not what the order asked for (oversold order)", async () => {
    // order asked for 5, only 2 were in stock: the SALE movement recorded -2
    const { w, tx } = makeWorld({ items: [item({ quantity: 0 })], movements: [sale({ inventoryItemId: "i1", quantityChange: -2 })] });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.items[0].quantity).toBe(2);
    expect(w.movements.find((m) => m.type === "RETURN")).toMatchObject({ quantityChange: 2, quantityAfter: 2, orderId: "o1" });
    expect(w.batches[0]).toMatchObject({ quantityReceived: 2, quantityRemaining: 2 });
  });

  it("restores nothing when the sale never took stock", async () => {
    const { w, tx } = makeWorld({ items: [item({ quantity: 4 })], movements: [] });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.items[0].quantity).toBe(4);
    expect(w.movements).toHaveLength(0);
    expect(w.batches).toHaveLength(0);
  });

  it("ignores zero-unit SALE movements (order placed against empty stock)", async () => {
    const { w, tx } = makeWorld({ items: [item({ quantity: 0 })], movements: [sale({ inventoryItemId: "i1", quantityChange: 0 })] });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.items[0].quantity).toBe(0);
  });

  it("is idempotent: a second refund adds nothing", async () => {
    const { w, tx } = makeWorld({ items: [item({ quantity: 1 })], movements: [sale({ inventoryItemId: "i1", quantityChange: -3 })] });
    expect(await restoreInventoryForRefund(tx, "o1", "s1")).toBe(true);
    expect(await restoreInventoryForRefund(tx, "o1", "s1")).toBe(false);
    expect(w.items[0].quantity).toBe(4);
  });

  it("adds to the live balance (atomic increment) instead of overwriting it", async () => {
    // another sale took stock after this order's sale; refund must add on top of 7
    const { w, tx } = makeWorld({ items: [item({ quantity: 7 })], movements: [sale({ inventoryItemId: "i1", quantityChange: -3 })] });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.items[0].quantity).toBe(10);
  });

  it("restores POS sales that carry the order only in the note, and legacy movements without orderId", async () => {
    const pos = sale({ orderId: null, note: "POS sale (order o1)", inventoryItemId: "i1", quantityChange: -2 });
    const other = sale({ orderId: null, note: "POS sale (order o2)", inventoryItemId: "i1", quantityChange: -9 });
    const { w, tx } = makeWorld({ items: [item({ quantity: 1 })], movements: [pos, other] });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.items[0].quantity).toBe(3); // only order o1's 2 units
  });

  it("restores recipe ingredients and leaves the dish's own count alone", async () => {
    const flour = item({ id: "flour", quantity: 10, productId: "pf" });
    const dish = item({ id: "dish", quantity: 5, productId: "pd" });
    const { w, tx } = makeWorld({
      items: [flour, dish],
      movements: [sale({ inventoryItemId: "flour", quantityChange: -4, note: "Online sale of Cake x2 (order o1) — recipe ingredient" })],
    });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.items.find((i) => i.id === "flour")!.quantity).toBe(14);
    expect(w.items.find((i) => i.id === "dish")!.quantity).toBe(5);
  });

  it("sums several movements on the same stock row into one return", async () => {
    const { w, tx } = makeWorld({ items: [item({ quantity: 0 })], movements: [sale({ inventoryItemId: "i1", quantityChange: -1 }), sale({ inventoryItemId: "i1", quantityChange: -2 })] });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.items[0].quantity).toBe(3);
    expect(w.movements.filter((m) => m.type === "RETURN")).toHaveLength(1);
  });

  it("restores variants and clears their auto-unpublish flag", async () => {
    const v: Stock = { id: "v1", quantity: 0, autoUnpublished: true, costPrice: 20 };
    const { w, tx } = makeWorld({ variants: [v], movements: [sale({ variantId: "v1", quantityChange: -2 })] });
    await restoreInventoryForRefund(tx, "o1", "s1");
    expect(w.variants[0]).toMatchObject({ quantity: 2, autoUnpublished: false });
    expect(w.movements.find((m) => m.type === "RETURN")).toMatchObject({ variantId: "v1", quantityChange: 2 });
  });

  it("republishes only a product that was auto-unpublished at zero", async () => {
    const a = makeWorld({ items: [item({ quantity: 0, autoUnpublished: true })], movements: [sale({ inventoryItemId: "i1", quantityChange: -1 })] });
    await restoreInventoryForRefund(a.tx, "o1", "s1");
    expect(a.w.published.get("p1")).toBe(true);
    expect(a.w.items[0].autoUnpublished).toBe(false);

    // merchant unpublished a well-stocked item by hand: refund must not republish it
    const b = makeWorld({ items: [item({ quantity: 5, autoUnpublished: false })], movements: [sale({ inventoryItemId: "i1", quantityChange: -1 })] });
    await restoreInventoryForRefund(b.tx, "o1", "s1");
    expect(b.w.published.has("p1")).toBe(false);
  });

  it("returns the lot at the cost the units were sold out of, else the row's cost", async () => {
    const consumed = sale({ inventoryItemId: "i1", quantityChange: -4, batchConsumptions: [{ quantity: 1, unitCost: 10 }, { quantity: 3, unitCost: 30 }] });
    const a = makeWorld({ items: [item({ costPrice: 99 })], movements: [consumed] });
    await restoreInventoryForRefund(a.tx, "o1", "s1");
    expect(a.w.batches[0].unitCost).toBe(25); // (1*10 + 3*30) / 4

    const b = makeWorld({ items: [item({ costPrice: 99 })], movements: [sale({ inventoryItemId: "i1", quantityChange: -1 })] });
    await restoreInventoryForRefund(b.tx, "o1", "s1");
    expect(b.w.batches[0].unitCost).toBe(99);
  });

  it("throws ORDER_NOT_FOUND for an unknown order", async () => {
    const { tx } = makeWorld({ orderExists: false });
    await expect(restoreInventoryForRefund(tx, "o1", "s1")).rejects.toThrow("ORDER_NOT_FOUND");
  });
});
