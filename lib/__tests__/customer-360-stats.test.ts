import { describe, expect, it } from "vitest";
import { summarizeCustomers } from "@/lib/customer-360-stats";

describe("summarizeCustomers", () => {
  it("averages by order, not by customer", () => {
    // Averaging the two per-customer averages (1000 and 1000) would hide the weighting;
    // use unequal averages below to prove it.
    const r = summarizeCustomers([
      { spent: 5000, orders: 1 }, // avg 5000
      { spent: 10000, orders: 10 }, // avg 1000
    ]);
    // Per-customer averaging would give 3000; the true per-order average is 15000 / 11.
    expect(r.averageOrder).toBeCloseTo(15000 / 11);
    expect(r.lifetimeValue).toBe(15000);
    expect(r.totalOrders).toBe(11);
  });
  it("ignores zero-order profiles instead of dragging the average down", () => {
    const r = summarizeCustomers([{ spent: 3000, orders: 3 }, { spent: 0, orders: 0 }, { spent: 0, orders: 0 }]);
    expect(r.averageOrder).toBe(1000);
  });
  it("counts repeat customers and handles empty input", () => {
    expect(summarizeCustomers([{ spent: 1, orders: 2 }, { spent: 1, orders: 1 }]).repeatCount).toBe(1);
    expect(summarizeCustomers([])).toEqual({ lifetimeValue: 0, totalOrders: 0, repeatCount: 0, averageOrder: 0 });
  });
});
