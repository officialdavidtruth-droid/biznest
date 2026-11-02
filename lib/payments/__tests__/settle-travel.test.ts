import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    payment: { updateMany: vi.fn() },
    travelPayment: { findFirst: vi.fn(), create: vi.fn() },
    travelPackage: { findUnique: vi.fn() },
    travelTraveler: { count: vi.fn() },
    travelTrip: { update: vi.fn() },
  };
  return { tx, paymentFind: vi.fn(), payout: vi.fn(), ledger: vi.fn(), warn: vi.fn(), email: vi.fn(), notify: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: { payment: { findUnique: m.paymentFind }, $transaction: (fn: (tx: typeof m.tx) => Promise<unknown>) => fn(m.tx) } }));
vi.mock("@/lib/payments/payout", () => ({ settleAndPayout: m.payout }));
vi.mock("@/lib/financial/order-ledger", () => ({ postPaymentToLedgerByReference: m.ledger }));
vi.mock("@/lib/observability/log", () => ({ logWarn: m.warn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/payments/travel-confirmation", () => ({ sendTravelPaymentEmail: m.email, notifyAgencyOfTravelPayment: m.notify }));

import { settleTravelPayment } from "@/lib/payments/settle-travel";

function payment(over: Record<string, unknown> = {}, trip: Record<string, unknown> = {}) {
  return {
    id: "pay1", reference: "TVL-trip1-abc", purpose: "TRAVEL_BOOKING", provider: "PAYSTACK", status: "PENDING", amount: "60000",
    travelTrip: { id: "trip1", status: "ENQUIRY", totalPrice: "200000", packageId: "pkg1", store: { slug: "wander" }, travellers: [{ id: "a" }, { id: "b" }], ...trip },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  m.tx.travelPayment.findFirst.mockResolvedValue(null);
  m.tx.travelPackage.findUnique.mockResolvedValue({ seats: 10 });
  m.tx.travelTraveler.count.mockResolvedValue(0);
});

describe("settleTravelPayment", () => {
  it("refuses payments that are not travel bookings or have no trip", async () => {
    m.paymentFind.mockResolvedValue(payment({ purpose: "ORDER" }));
    expect((await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {})).success).toBe(false);
    m.paymentFind.mockResolvedValue(null);
    expect((await settleTravelPayment("nope", "PAYSTACK", 60000, {})).success).toBe(false);
    expect(m.tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a provider mismatch and an underpayment, without touching the database", async () => {
    m.paymentFind.mockResolvedValue(payment());
    expect(await settleTravelPayment("TVL-trip1-abc", "FLUTTERWAVE", 60000, {})).toEqual({ success: false, error: "Payment provider mismatch." });
    expect(await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 59000, {})).toEqual({ success: false, error: "Payment amount mismatch." });
    expect(m.tx.payment.updateMany).not.toHaveBeenCalled();
    expect(m.payout).not.toHaveBeenCalled();
  });

  it("refuses a currency mismatch, and any non-NGN payment the gateway did not confirm a currency for", async () => {
    m.paymentFind.mockResolvedValue(payment({ currency: "USD", amount: "500" }));
    expect(await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 500, {}, "NGN")).toEqual({ success: false, error: "Payment currency mismatch." });
    expect(await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 500, {})).toEqual({ success: false, error: "Payment currency mismatch." });
    expect(m.tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it("settles a USD payment when the gateway confirms USD", async () => {
    m.paymentFind.mockResolvedValue(payment({ currency: "USD", amount: "500" }));
    const r = await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 500, {}, "usd");
    expect(r.success).toBe(true);
    expect(m.tx.travelPayment.create.mock.calls[0][0].data).toMatchObject({ amount: "500", status: "RECEIVED" });
  });

  it("accepts an overpayment (gateway fee on top) but records the agreed amount on the trip", async () => {
    m.paymentFind.mockResolvedValue(payment());
    const r = await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 61250, { fee: true });
    expect(r.success).toBe(true);
    expect(m.tx.travelPayment.create.mock.calls[0][0].data).toMatchObject({ tripId: "trip1", amount: "60000", status: "RECEIVED", reference: "TVL-trip1-abc", method: "CARD" });
    expect(m.ledger).toHaveBeenCalledWith("TVL-trip1-abc");
    expect(m.payout).toHaveBeenCalledWith("TVL-trip1-abc");
  });

  it("is idempotent: an already successful payment does nothing again", async () => {
    m.paymentFind.mockResolvedValue(payment({ status: "SUCCESSFUL" }));
    const r = await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {});
    expect(r).toEqual({ success: true, data: { storeSlug: "wander", tripId: "trip1" } });
    expect(m.tx.payment.updateMany).not.toHaveBeenCalled();
    expect(m.payout).not.toHaveBeenCalled();
  });

  it("does not record the money twice when two webhooks race", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
    await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {});
    expect(m.tx.travelPayment.create).not.toHaveBeenCalled();
    expect(m.tx.travelTrip.update).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled(); // a replayed webhook must not email the traveller again
    expect(m.notify).not.toHaveBeenCalled(); // or alert the agency again
  });

  it("emails the traveller a receipt once, when this call settles the payment", async () => {
    m.paymentFind.mockResolvedValue(payment());
    await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {});
    expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.email).toHaveBeenCalledWith("TVL-trip1-abc");
    expect(m.notify).toHaveBeenCalledTimes(1);
    expect(m.notify).toHaveBeenCalledWith("TVL-trip1-abc");
  });

  it("does not email for refused payments or already-settled ones", async () => {
    m.paymentFind.mockResolvedValue(payment());
    await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 100, {});
    m.paymentFind.mockResolvedValue(payment({ status: "SUCCESSFUL" }));
    await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {});
    expect(m.email).not.toHaveBeenCalled();
  });

  it("confirms a paid enquiry when seats remain", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.tx.travelTraveler.count.mockResolvedValue(5); // 5 of 10 taken, trip needs 2
    await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {});
    expect(m.tx.travelTrip.update).toHaveBeenCalledWith({ where: { id: "trip1" }, data: { status: "CONFIRMED" } });
    expect(m.warn).not.toHaveBeenCalled();
  });

  it("keeps the trip as an enquiry and flags it when the tour sold out meanwhile", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.tx.travelTraveler.count.mockResolvedValue(9); // only 1 seat left, trip needs 2
    await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {});
    expect(m.tx.travelPayment.create).toHaveBeenCalled(); // the money is still recorded
    expect(m.tx.travelTrip.update).not.toHaveBeenCalled();
    expect(m.warn).toHaveBeenCalledWith("PAYMENTS", expect.stringContaining("no longer has enough seats"), expect.anything());
  });

  it("does not revive a cancelled trip but flags the payment for a refund", async () => {
    m.paymentFind.mockResolvedValue(payment({}, { status: "CANCELLED" }));
    await settleTravelPayment("TVL-trip1-abc", "PAYSTACK", 60000, {});
    expect(m.tx.travelTrip.update).not.toHaveBeenCalled();
    expect(m.warn).toHaveBeenCalledWith("PAYMENTS", expect.stringContaining("cancelled trip"), expect.anything());
  });

  it("records a bank-transfer confirmation as a transfer", async () => {
    m.paymentFind.mockResolvedValue(payment({ provider: "CASH" }));
    await settleTravelPayment("TVL-trip1-abc", "CASH", 60000, {});
    expect(m.tx.travelPayment.create.mock.calls[0][0].data.method).toBe("TRANSFER");
  });
});
