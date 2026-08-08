import { describe, expect, it } from "vitest";
import { calculateOrderTotals, calculateSubtotal, roundMoney } from "../pricing";

describe("roundMoney", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3); // classic float trap
  });
});

describe("calculateSubtotal", () => {
  it("sums unit price * quantity across lines", () => {
    const subtotal = calculateSubtotal([
      { unitPrice: 1000, quantity: 2 },
      { unitPrice: 250.5, quantity: 3 },
    ]);
    expect(subtotal).toBe(2751.5);
  });

  it("returns 0 for an empty cart", () => {
    expect(calculateSubtotal([])).toBe(0);
  });
});

describe("calculateOrderTotals", () => {
  it("computes commission on subtotal only, never on delivery fee", () => {
    const result = calculateOrderTotals([{ unitPrice: 10000, quantity: 1 }], 500, 8);
    expect(result.subtotal).toBe(10000);
    expect(result.deliveryFee).toBe(500);
    // 8% of subtotal (10000), NOT of subtotal+delivery (10500)
    expect(result.commission).toBe(800);
    expect(result.total).toBe(10500);
  });

  it("keeps delivery fee out of the total's commission base even at odd rates", () => {
    const result = calculateOrderTotals([{ unitPrice: 3333.33, quantity: 3 }], 1200, 12.5);
    expect(result.subtotal).toBe(9999.99);
    expect(result.commission).toBe(roundMoney(9999.99 * 0.125));
    expect(result.total).toBe(roundMoney(9999.99 + 1200));
  });

  it("never produces a negative delivery fee even if given one", () => {
    const result = calculateOrderTotals([{ unitPrice: 100, quantity: 1 }], -50, 8);
    expect(result.deliveryFee).toBe(0);
    expect(result.total).toBe(100);
  });

  it("handles a zero commission rate (e.g. Free tier edge case)", () => {
    const result = calculateOrderTotals([{ unitPrice: 500, quantity: 4 }], 0, 0);
    expect(result.commission).toBe(0);
    expect(result.total).toBe(2000);
  });

  it("handles multiple line items with mixed quantities", () => {
    const result = calculateOrderTotals(
      [
        { unitPrice: 1500, quantity: 2 },
        { unitPrice: 799.99, quantity: 1 },
        { unitPrice: 250, quantity: 5 },
      ],
      750,
      8
    );
    expect(result.subtotal).toBe(1500 * 2 + 799.99 + 250 * 5);
    expect(result.total).toBe(result.subtotal + 750);
  });
});
