import { describe, expect, it } from "vitest";
import { planReorders, suggestedReorderQty, type LowStockItem } from "@/lib/chores/reorders";
import { summarizePayouts } from "@/lib/chores/payouts";
import { ledgerCsv, monthBoundsUtc, previousMonth, safeCell, type LedgerOrder } from "@/lib/chores/month-end";

const item = (o: Partial<LowStockItem> & { productId: string }): LowStockItem => ({
  name: o.productId, quantity: 2, threshold: 5, costPrice: null, suppliers: [], ...o,
});

describe("planReorders", () => {
  it("sizes like the inventory page: 2x threshold minus on-hand, min 1", () => {
    expect(suggestedReorderQty({ quantity: 2, threshold: 5 })).toBe(8);
    expect(suggestedReorderQty({ quantity: 20, threshold: 5 })).toBe(1);
  });

  it("groups lines by supplier and picks the cheapest known supplier", () => {
    const plan = planReorders([
      item({ productId: "a", suppliers: [{ supplierId: "s1", costPrice: 500 }, { supplierId: "s2", costPrice: 400 }] }),
      item({ productId: "b", suppliers: [{ supplierId: "s2", costPrice: 100 }] }),
      item({ productId: "c", suppliers: [{ supplierId: "s1", costPrice: null }, { supplierId: "s3", costPrice: 50 }] }),
    ], new Set());
    const s2 = plan.orders.find((o) => o.supplierId === "s2")!;
    expect(s2.lines.map((l) => l.productId).sort()).toEqual(["a", "b"]);
    expect(plan.orders.find((o) => o.supplierId === "s3")!.lines[0].productId).toBe("c");
    expect(plan.orders.some((o) => o.supplierId === "s1")).toBe(false);
  });

  it("skips items already on an open PO and reports ones with no supplier", () => {
    const plan = planReorders([
      item({ productId: "a", suppliers: [{ supplierId: "s1", costPrice: 1 }] }),
      item({ productId: "b" }),
    ], new Set(["a"]));
    expect(plan.orders).toEqual([]);
    expect(plan.skippedAlreadyOrdered).toBe(1);
    expect(plan.unassigned.map((u) => u.productId)).toEqual(["b"]);
  });

  it("ignores items that are not actually low", () => {
    expect(planReorders([item({ productId: "a", quantity: 9, suppliers: [{ supplierId: "s1", costPrice: 1 }] })], new Set()).orders).toEqual([]);
  });

  it("treats variants of one product as separate lines and matches open POs per variant", () => {
    const sup = [{ supplierId: "s1", costPrice: 10 }];
    const plan = planReorders([
      item({ productId: "p", variantId: "v1", name: "Tee — S", suppliers: sup }),
      item({ productId: "p", variantId: "v2", name: "Tee — M", suppliers: sup }),
    ], new Set(["v1"]));
    expect(plan.skippedAlreadyOrdered).toBe(1);
    expect(plan.orders[0].lines).toHaveLength(1);
    expect(plan.orders[0].lines[0]).toMatchObject({ productId: "p", variantId: "v2", description: "Tee — M" });
  });

  it("falls back to the item's own cost when the supplier link has none", () => {
    const plan = planReorders([item({ productId: "a", costPrice: 70, suppliers: [{ supplierId: "s1", costPrice: null }] })], new Set());
    expect(plan.orders[0].lines[0].unitCost).toBe(70);
  });
});

describe("summarizePayouts", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
  it("totals paid, flags failed/reversed, and only calls old pending ones stuck", () => {
    const d = summarizePayouts([
      { status: "PAID", amount: 900, feeAmount: 50, createdAt: h(10) },
      { status: "PAID", amount: 100, feeAmount: 10, createdAt: h(20) },
      { status: "FAILED", amount: 300, feeAmount: 0, createdAt: h(5) },
      { status: "REVERSED", amount: 200, feeAmount: 0, createdAt: h(5) },
      { status: "QUEUED", amount: 40, feeAmount: 0, createdAt: h(10) },
      { status: "PROCESSING", amount: 60, feeAmount: 0, createdAt: h(60) },
    ], now);
    expect(d).toMatchObject({ paidCount: 2, paidTotal: 1000, feesTotal: 60, problemCount: 2, problemTotal: 500, stuckCount: 1, stuckTotal: 60 });
  });
});

describe("month-end export", () => {
  it("previousMonth rolls over the year", () => {
    expect(previousMonth(new Date("2027-01-01T08:00:00Z"))).toBe("2026-12");
    expect(previousMonth(new Date("2026-11-01T08:00:00Z"))).toBe("2026-10");
  });

  it("month bounds follow the store timezone (Lagos is UTC+1)", () => {
    const b = monthBoundsUtc("2026-10", "Africa/Lagos")!;
    expect(b.start.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(monthBoundsUtc("2026-13", "Africa/Lagos")).toBeNull();
    expect(monthBoundsUtc("nope", "Africa/Lagos")).toBeNull();
  });

  it("neutralises spreadsheet formulas in customer names", () => {
    expect(safeCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(safeCell("+234")).toBe("'+234");
    expect(safeCell("Ada")).toBe("Ada");
  });

  it("writes a header plus one row per order, with a BOM", () => {
    const row: LedgerOrder = {
      createdAt: new Date("2026-10-05T10:00:00Z"), orderId: "o1", status: "PAID", channel: "ONLINE", customer: "=cmd",
      subtotal: 1000, deliveryFee: 200, total: 1200, currency: "NGN", provider: "FLUTTERWAVE", paymentReference: "r1",
      refundedAmount: 0, payoutAmount: 1150, gatewayFee: 50, payoutStatus: "PAID", payoutPaidAt: new Date("2026-10-06T00:00:00Z"),
    };
    const csv = ledgerCsv([row]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("'=cmd");
    expect(lines[1]).toContain("1150.00");
  });
});
