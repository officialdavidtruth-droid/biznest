import { describe, expect, it } from "vitest";
import { checkRefundAmount, netReceived, payoutShareOfRefund, tripMoney } from "@/lib/travel";

describe("netReceived / tripMoney with refunds", () => {
  it("counts a partial refund as money the agency no longer holds, and a full refund as nothing", () => {
    expect(netReceived({ amount: 500_000, status: "RECEIVED", refundedAmount: 400_000 })).toBe(100_000);
    expect(netReceived({ amount: 500_000, status: "REFUNDED", refundedAmount: 500_000 })).toBe(0);
    expect(netReceived({ amount: 500_000, status: "DUE" })).toBe(0);
    expect(netReceived({ amount: 500_000, status: "RECEIVED" })).toBe(500_000);
  });
  it("raises the balance after a refund and reports the refunded total", () => {
    const m = tripMoney({ totalPrice: 1_000_000, totalCost: 700_000 }, [
      { amount: 600_000, status: "RECEIVED", refundedAmount: 450_000 },
      { amount: 200_000, status: "REFUNDED", refundedAmount: 200_000 },
      { amount: 100_000, status: "VOID" },
    ]);
    expect(m.paid).toBe(150_000);
    expect(m.balance).toBe(850_000);
    expect(m.refunded).toBe(650_000);
  });
});

describe("checkRefundAmount", () => {
  const pay = { amount: 500_000, status: "RECEIVED", refundedAmount: 0 };
  it("allows a partial refund and flags a full one", () => {
    expect(checkRefundAmount(pay, 400_000)).toEqual({ ok: true, amount: 400_000, full: false });
    expect(checkRefundAmount(pay, "500000")).toEqual({ ok: true, amount: 500_000, full: true });
  });
  it("rejects zero, negative, junk and over-refunds", () => {
    for (const bad of [0, -5, "abc", NaN, undefined]) expect(checkRefundAmount(pay, bad).ok).toBe(false);
    expect(checkRefundAmount(pay, 500_001).ok).toBe(false);
  });
  it("rejects payments that are not received or are already refunded", () => {
    expect(checkRefundAmount({ amount: 500_000, status: "DUE" }, 100).ok).toBe(false);
    expect(checkRefundAmount({ amount: 500_000, status: "VOID" }, 100).ok).toBe(false);
    expect(checkRefundAmount({ amount: 500_000, status: "RECEIVED", refundedAmount: 100 }, 100).ok).toBe(false);
    expect(checkRefundAmount({ amount: 500_000, status: "REFUNDED", refundedAmount: 500_000 }, 100).ok).toBe(false);
  });
  it("rounds to kobo", () => {
    expect(checkRefundAmount(pay, 100.456)).toEqual({ ok: true, amount: 100.46, full: false });
  });
});

describe("payoutShareOfRefund", () => {
  it("scales the vendor payout by the refunded share of the charge", () => {
    expect(payoutShareOfRefund(480_000, 500_000, 250_000)).toBe(240_000);
    expect(payoutShareOfRefund(480_000, 500_000, 500_000)).toBe(480_000);
  });
  it("never exceeds the payout and handles bad input", () => {
    expect(payoutShareOfRefund(480_000, 500_000, 900_000)).toBe(480_000);
    expect(payoutShareOfRefund(0, 500_000, 100)).toBe(0);
    expect(payoutShareOfRefund(480_000, 0, 100)).toBe(0);
  });
});
