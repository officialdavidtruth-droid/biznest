import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    payment: { updateMany: vi.fn() },
    travelPayment: { updateMany: vi.fn() },
    payout: { findUnique: vi.fn(), updateMany: vi.fn() },
    storeRefundClawback: { create: vi.fn() },
    store: { update: vi.fn() },
    subscription: { findUnique: vi.fn() },
  };
  return {
    tx,
    tpFind: vi.fn(), payFind: vi.fn(), payUpdateMany: vi.fn(), transaction: vi.fn(),
    gatewayRefund: vi.fn(), email: vi.fn(), activity: vi.fn(), webhook: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    travelPayment: { findFirst: m.tpFind },
    payment: { findFirst: m.payFind, updateMany: m.payUpdateMany },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/payments/gateway", () => ({ refundPayment: m.gatewayRefund }));
vi.mock("@/lib/payments/store-gateway", () => ({ secretKeyForPayment: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/activity-log", () => ({ logActivity: m.activity }));
vi.mock("@/lib/webhooks/dispatch", () => ({ emitWebhookEvent: m.webhook }));
vi.mock("@/lib/observability/log", () => ({ logWarn: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/payments/travel-confirmation", () => ({ sendTravelRefundEmail: m.email }));

import { recordTravelPayoutRefundEffect, refundTravelPayment } from "@/lib/payments/refund-travel";

const store = { id: "storeA", slug: "wander" };
const base = { store, actorEmail: "owner@wander.test", tripId: "trip1", travelPaymentId: "tp1", reason: "Visa refused" };
const tp = (over: Record<string, unknown> = {}) => ({ id: "tp1", tripId: "trip1", amount: "500000", status: "RECEIVED", refundedAmount: "0", reference: "TVL-trip1-abc", ...over });
const gw = (over: Record<string, unknown> = {}) => ({ id: "pay1", provider: "PAYSTACK", status: "SUCCESSFUL", amount: "500000", currency: "NGN", reference: "TVL-trip1-abc", rawPayload: null, splitSubaccountCode: null, verifiedAt: new Date(), ...over });

beforeEach(() => {
  vi.clearAllMocks();
  m.transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
  m.tx.travelPayment.updateMany.mockResolvedValue({ count: 1 });
  m.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  m.tx.payout.findUnique.mockResolvedValue(null);
  m.payUpdateMany.mockResolvedValue({ count: 1 });
  m.gatewayRefund.mockResolvedValue({ success: true, refundReference: "rf_1" });
});

describe("refundTravelPayment: validation and tenant isolation", () => {
  it("scopes the payment lookup to the caller's store and stops when it is not found", async () => {
    m.tpFind.mockResolvedValue(null);
    expect(await refundTravelPayment({ ...base, amount: 100 })).toEqual({ success: false, error: "Payment not found." });
    expect(m.tpFind.mock.calls[0][0].where).toMatchObject({ id: "tp1", tripId: "trip1", trip: { storeId: "storeA" } });
    expect(m.gatewayRefund).not.toHaveBeenCalled();
  });

  it("requires a reason and rejects over-refunds before touching the gateway", async () => {
    m.tpFind.mockResolvedValue(tp());
    expect((await refundTravelPayment({ ...base, amount: 100, reason: " " })).success).toBe(false);
    expect((await refundTravelPayment({ ...base, amount: 500_001 })).success).toBe(false);
    expect(m.payUpdateMany).not.toHaveBeenCalled();
    expect(m.gatewayRefund).not.toHaveBeenCalled();
  });

  it("refuses a second refund on the same payment", async () => {
    m.tpFind.mockResolvedValue(tp({ refundedAmount: "100000" }));
    expect((await refundTravelPayment({ ...base, amount: 100 })).success).toBe(false);
    expect(m.gatewayRefund).not.toHaveBeenCalled();
  });
});

describe("refundTravelPayment: online payments", () => {
  it("claims the payment first, refunds the partial amount through the gateway, then records it", async () => {
    m.tpFind.mockResolvedValue(tp());
    m.payFind.mockResolvedValue(gw());
    const r = await refundTravelPayment({ ...base, amount: 400_000 });
    expect(r).toEqual({ success: true, data: { mode: "gateway", amount: 400_000, full: false } });
    expect(m.payUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: "pay1", status: "SUCCESSFUL" }, data: { status: "REFUND_PENDING", refundedAmount: 400_000 } });
    expect(m.gatewayRefund).toHaveBeenCalledWith(expect.objectContaining({ provider: "PAYSTACK", gatewayTransactionRef: "TVL-trip1-abc", amountNaira: 400_000 }));
    expect(m.payUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(m.gatewayRefund.mock.invocationCallOrder[0]);
    // partial: the travel payment stays RECEIVED (no status change), only the refunded fields are written
    const travelWrite = m.tx.travelPayment.updateMany.mock.calls[0][0];
    expect(travelWrite.data.status).toBeUndefined();
    expect(travelWrite.data).toMatchObject({ refundedAmount: 400_000, refundReference: "rf_1" });
    expect(m.tx.payment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REFUNDED", refundedAmount: 400_000, refundReference: "rf_1" });
    expect(m.email).toHaveBeenCalledWith("trip1", 400_000, false, "gateway");
  });

  it("marks the travel payment REFUNDED on a full refund", async () => {
    m.tpFind.mockResolvedValue(tp());
    m.payFind.mockResolvedValue(gw());
    const r = await refundTravelPayment({ ...base, amount: 500_000 });
    expect(r.success && r.data.full).toBe(true);
    expect(m.tx.travelPayment.updateMany.mock.calls[0][0].data.status).toBe("REFUNDED");
  });

  it("uses Flutterwave's numeric transaction id", async () => {
    m.tpFind.mockResolvedValue(tp());
    m.payFind.mockResolvedValue(gw({ provider: "FLUTTERWAVE", rawPayload: { data: { id: 987654 } } }));
    await refundTravelPayment({ ...base, amount: 1000 });
    expect(m.gatewayRefund).toHaveBeenCalledWith(expect.objectContaining({ provider: "FLUTTERWAVE", gatewayTransactionRef: "987654" }));
  });

  it("does not call the gateway when another request already claimed the payment", async () => {
    m.tpFind.mockResolvedValue(tp());
    m.payFind.mockResolvedValue(gw());
    m.payUpdateMany.mockResolvedValue({ count: 0 });
    expect((await refundTravelPayment({ ...base, amount: 1000 })).success).toBe(false);
    expect(m.gatewayRefund).not.toHaveBeenCalled();
  });

  it("releases the claim and records nothing when the gateway declines", async () => {
    m.tpFind.mockResolvedValue(tp());
    m.payFind.mockResolvedValue(gw());
    m.gatewayRefund.mockResolvedValue({ success: false, error: "Insufficient balance" });
    expect(await refundTravelPayment({ ...base, amount: 1000 })).toEqual({ success: false, error: "Insufficient balance" });
    expect(m.payUpdateMany.mock.calls[1][0]).toMatchObject({ where: { id: "pay1", status: "REFUND_PENDING" }, data: { status: "SUCCESSFUL", refundedAmount: null } });
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("leaves the payment refund-pending (no duplicate refund possible) when local recording fails after the gateway accepted", async () => {
    m.tpFind.mockResolvedValue(tp());
    m.payFind.mockResolvedValue(gw());
    m.transaction.mockRejectedValue(new Error("db down"));
    const r = await refundTravelPayment({ ...base, amount: 1000 });
    expect(r.success).toBe(false);
    expect(m.payUpdateMany).toHaveBeenCalledTimes(1); // only the claim, never reverted to SUCCESSFUL
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("refundTravelPayment: manual payments", () => {
  it("records the refund without any gateway call when there is no online payment behind it", async () => {
    m.tpFind.mockResolvedValue(tp({ reference: null }));
    const r = await refundTravelPayment({ ...base, amount: 200_000 });
    expect(r).toEqual({ success: true, data: { mode: "recorded", amount: 200_000, full: false } });
    expect(m.gatewayRefund).not.toHaveBeenCalled();
    expect(m.payUpdateMany).not.toHaveBeenCalled();
    expect(m.email).toHaveBeenCalledWith("trip1", 200_000, false, "recorded");
  });

  it("reports a concurrent duplicate instead of recording twice", async () => {
    m.tpFind.mockResolvedValue(tp({ reference: null }));
    m.tx.travelPayment.updateMany.mockResolvedValue({ count: 0 });
    expect((await refundTravelPayment({ ...base, amount: 1000 })).success).toBe(false);
    expect(m.email).not.toHaveBeenCalled();
  });
});

describe("recordTravelPayoutRefundEffect", () => {
  const payout = (status: string) => ({ id: "po1", storeId: "storeA", status, amount: "480000" });

  it("does nothing when the payment has no payout", async () => {
    expect(await recordTravelPayoutRefundEffect(m.tx as never, "pay1", 500_000, 100_000)).toBe(false);
  });
  it("cancels an unsent payout on a full refund", async () => {
    m.tx.payout.findUnique.mockResolvedValue(payout("QUEUED"));
    m.tx.payout.updateMany.mockResolvedValue({ count: 1 });
    expect(await recordTravelPayoutRefundEffect(m.tx as never, "pay1", 500_000, 500_000)).toBe(true);
    expect(m.tx.payout.updateMany.mock.calls[0][0].data.status).toBe("FAILED");
  });
  it("reduces an unsent payout pro rata on a partial refund", async () => {
    m.tx.payout.findUnique.mockResolvedValue(payout("HELD"));
    m.tx.payout.updateMany.mockResolvedValue({ count: 1 });
    await recordTravelPayoutRefundEffect(m.tx as never, "pay1", 500_000, 250_000);
    expect(m.tx.payout.updateMany.mock.calls[0][0].data).toEqual({ amount: { decrement: 240_000 } });
  });
  it("records a clawback for the refunded share when the payout was already sent", async () => {
    m.tx.payout.findUnique.mockResolvedValue(payout("PAID"));
    await recordTravelPayoutRefundEffect(m.tx as never, "pay1", 500_000, 250_000);
    expect(m.tx.storeRefundClawback.create.mock.calls[0][0].data).toMatchObject({ storeId: "storeA", paymentId: "pay1", amount: 240_000 });
    expect(m.tx.store.update.mock.calls[0][0].data).toEqual({ refundClawbackOwed: { increment: 240_000 } });
  });
  it("owes nothing when the payout failed", async () => {
    m.tx.payout.findUnique.mockResolvedValue(payout("FAILED"));
    await recordTravelPayoutRefundEffect(m.tx as never, "pay1", 500_000, 500_000);
    expect(m.tx.storeRefundClawback.create).not.toHaveBeenCalled();
  });
});
