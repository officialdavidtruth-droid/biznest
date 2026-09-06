import { describe, expect, it } from "vitest";
import { reconcileStockLedger } from "@/lib/inventory-reconciliation";

describe("inventory ledger reconciliation", () => {
  it("accepts a continuous ledger and current quantity", () => {
    const result = reconcileStockLedger(7, [
      { id: "a", quantityChange: 10, quantityAfter: 10 },
      { id: "b", quantityChange: -3, quantityAfter: 7 },
    ]);
    expect(result.status).toBe("OK");
    expect(result.openingQuantity).toBe(0);
    expect(result.ledgerQuantity).toBe(7);
    expect(result.discrepancy).toBe(0);
  });

  it("does not assume the first historical movement started from zero", () => {
    const result = reconcileStockLedger(12, [
      { id: "a", quantityChange: 2, quantityAfter: 12 },
    ]);
    expect(result.status).toBe("OK");
    expect(result.openingQuantity).toBe(10);
  });

  it("flags stored quantity drift", () => {
    const result = reconcileStockLedger(8, [
      { id: "a", quantityChange: 10, quantityAfter: 10 },
      { id: "b", quantityChange: -3, quantityAfter: 7 },
    ]);
    expect(result.status).toBe("DISCREPANCY");
    expect(result.discrepancy).toBe(1);
  });

  it("flags a broken running balance separately from simple drift", () => {
    const result = reconcileStockLedger(7, [
      { id: "a", quantityChange: 10, quantityAfter: 10 },
      { id: "b", quantityChange: -3, quantityAfter: 8 },
      { id: "c", quantityChange: -1, quantityAfter: 7 },
    ]);
    expect(result.status).toBe("LEDGER_CORRUPT");
    expect(result.errors.some((e) => e.includes("running balance"))).toBe(true);
  });

  it("flags stock with no ledger history as unverified", () => {
    const result = reconcileStockLedger(5, []);
    expect(result.status).toBe("NO_LEDGER");
    expect(result.ledgerQuantity).toBeNull();
  });
});
