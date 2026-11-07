import { describe, it, expect } from "vitest";
import { buildPurgePlan, purgeRows, type FkEdge, type PurgeDb } from "../purge";

type Row = Record<string, string | null> & { id: string };

// A tiny in-memory database that enforces the same delete rules Postgres does.
function makeDb(edges: FkEdge[], data: Record<string, Row[]>) {
  const tables = data;
  const db: PurgeDb = {
    async selectIds(table, col, values) {
      return (tables[table] ?? []).filter((r) => r[col] != null && values.includes(r[col] as string)).map((r) => r.id);
    },
    async deleteWhere(table, col, values) {
      const gone = (tables[table] ?? []).filter((r) => values.includes(r[col] as string));
      for (const row of gone) {
        for (const e of edges.filter((x) => x.parent === table)) {
          const kids = (tables[e.child] ?? []).filter((k) => k[e.childCol] === row.id);
          if (!kids.length) continue;
          if (e.action === "a" || e.action === "r") throw new Error(`FK violation: ${e.child}.${e.childCol} -> ${table}`);
          if (e.action === "c") await db.deleteWhere(e.child, e.childCol, [row.id]);
          if (e.action === "n") kids.forEach((k) => (k[e.childCol] = null));
        }
      }
      tables[table] = (tables[table] ?? []).filter((r) => !values.includes(r[col] as string));
      return gone.length;
    },
  };
  return { db, tables };
}

const edges: FkEdge[] = [
  { child: "Order", childCol: "storeId", parent: "Store", parentCol: "id", action: "r" },
  { child: "Payment", childCol: "storeId", parent: "Store", parentCol: "id", action: "n" },
  { child: "Payout", childCol: "storeId", parent: "Store", parentCol: "id", action: "c" },
  { child: "Payout", childCol: "paymentId", parent: "Payment", parentCol: "id", action: "r" },
  { child: "Product", childCol: "storeId", parent: "Store", parentCol: "id", action: "c" },
  { child: "OrderItem", childCol: "productId", parent: "Product", parentCol: "id", action: "r" },
  { child: "OrderItem", childCol: "orderId", parent: "Order", parentCol: "id", action: "c" },
  { child: "Clawback", childCol: "paymentId", parent: "Payment", parentCol: "id", action: "r" },
  { child: "Clawback", childCol: "storeId", parent: "Store", parentCol: "id", action: "c" },
];
const ids = ["Store", "Order", "Payment", "Payout", "Product", "OrderItem", "Clawback"];

describe("purgeRows", () => {
  it("plan marks tables whose dependents would block a delete", () => {
    const plan = buildPurgePlan(edges, ids);
    expect(plan.needsWalk.has("Store")).toBe(true); // Order restricts it
    expect(plan.needsWalk.has("Payment")).toBe(true); // Payout restricts it
    expect(plan.needsWalk.has("Product")).toBe(true); // OrderItem restricts it
    expect(plan.needsWalk.has("Payout")).toBe(false);
  });

  it("deletes a store whose payouts, clawbacks and orders would normally block it", async () => {
    const { db, tables } = makeDb(edges, {
      Store: [{ id: "s1" }, { id: "s2" }],
      Order: [{ id: "o1", storeId: "s1" }, { id: "o2", storeId: "s2" }],
      Product: [{ id: "p1", storeId: "s1" }],
      OrderItem: [{ id: "i1", orderId: "o1", productId: "p1" }],
      Payment: [{ id: "pay1", storeId: "s1" }, { id: "pay2", storeId: "s2" }],
      Payout: [{ id: "po1", storeId: "s1", paymentId: "pay1" }, { id: "po2", storeId: "s2", paymentId: "pay2" }],
      Clawback: [{ id: "c1", storeId: "s1", paymentId: "pay1" }],
    });
    // Sanity: a plain delete is refused, exactly like production.
    await expect(db.deleteWhere("Store", "id", ["s1"])).rejects.toThrow(/FK violation/);

    const plan = buildPurgePlan(edges, ids);
    // Payments reference the store with SET NULL, so they are only reachable through the payouts: purge them with the store.
    await purgeRows(db, plan, "Store", ["s1"]);
    expect(tables.Store.map((r) => r.id)).toEqual(["s2"]);
    expect(tables.Order.map((r) => r.id)).toEqual(["o2"]);
    expect(tables.OrderItem).toHaveLength(0);
    expect(tables.Product).toHaveLength(0);
    expect(tables.Payout.map((r) => r.id)).toEqual(["po2"]);
    expect(tables.Clawback).toHaveLength(0);
  });

  it("also deletes records that would only be unlinked, when asked to", async () => {
    const { db, tables } = makeDb(edges, {
      Store: [{ id: "s1" }],
      Payment: [{ id: "pay1", storeId: "s1" }, { id: "pay9", storeId: null }],
      Payout: [{ id: "po1", storeId: "s1", paymentId: "pay1" }],
    });
    await purgeRows(db, buildPurgePlan(edges, ids, ["Payment.storeId"]), "Store", ["s1"]);
    expect(tables.Payment.map((r) => r.id)).toEqual(["pay9"]);
  });

  it("leaves other stores untouched and tolerates repeats and cycles", async () => {
    const cyc: FkEdge[] = [
      { child: "A", childCol: "bId", parent: "B", parentCol: "id", action: "n" },
      { child: "B", childCol: "aId", parent: "A", parentCol: "id", action: "r" },
    ];
    const { db, tables } = makeDb(cyc, { A: [{ id: "a1", bId: "b1" }], B: [{ id: "b1", aId: "a1" }] });
    const plan = buildPurgePlan(cyc, ["A", "B"]);
    await purgeRows(db, plan, "A", ["a1", "a1"]);
    expect(tables.A).toHaveLength(0);
    expect(tables.B).toHaveLength(0);
  });
});
