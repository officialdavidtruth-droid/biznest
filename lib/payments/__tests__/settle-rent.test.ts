import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = { payment: { updateMany: vi.fn(), update: vi.fn() } };
  return { tx, paymentFind: vi.fn(), payout: vi.fn(), ledger: vi.fn(), warn: vi.fn(), error: vi.fn(), receipt: vi.fn(), email: vi.fn(), notify: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: { payment: { findUnique: m.paymentFind }, $transaction: (fn: (tx: typeof m.tx) => Promise<unknown>) => fn(m.tx) } }));
vi.mock("@/lib/payments/payout", () => ({ settleAndPayout: m.payout }));
vi.mock("@/lib/financial/order-ledger", () => ({ postPaymentToLedgerByReference: m.ledger }));
vi.mock("@/lib/observability/log", () => ({ logWarn: m.warn, logError: m.error }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/payments/rent-receipt", () => ({ markRentChargePaid: m.receipt }));
vi.mock("@/lib/payments/rent-confirmation", () => ({ sendRentReceiptEmail: m.email }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/utils/format-money", () => ({ formatMoney: (n: number) => `NGN ${n}` }));

import { settleRentPayment } from "@/lib/payments/settle-rent";

function payment(over: Record<string, unknown> = {}) {
  return {
    id: "pay1", reference: "RNT-ch1-abc", purpose: "RENT_PAYMENT", provider: "PAYSTACK", status: "PENDING", amount: "500000", currency: "NGN",
    rentCharge: { id: "ch1", storeId: "s1", label: "Rent Jan 2027", store: { id: "s1", slug: "homes", business: { user: { id: "owner1" } } }, unit: { unitNo: "3B", tenantName: "Ada", portalToken: "tok", property: { name: "Block A" } } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  m.receipt.mockResolvedValue("RCT-000001");
});

describe("settleRentPayment", () => {
  it("pays the charge, emails a receipt and tells the landlord", async () => {
    m.paymentFind.mockResolvedValue(payment());
    const r = await settleRentPayment("RNT-ch1-abc", "PAYSTACK", 500000, {}, "NGN");
    expect(r).toMatchObject({ success: true, data: { storeSlug: "homes", portalToken: "tok" } });
    expect(m.receipt).toHaveBeenCalledWith(m.tx, expect.objectContaining({ chargeId: "ch1", storeId: "s1", method: "CARD", reference: "RNT-ch1-abc" }));
    expect(m.email).toHaveBeenCalledWith("RNT-ch1-abc");
    expect(m.notify.mock.calls[0][0]).toMatchObject({ userId: "owner1", type: "RENT_PAYMENT" });
    expect(m.payout).toHaveBeenCalled();
  });

  it("is idempotent: a replayed webhook changes nothing", async () => {
    m.paymentFind.mockResolvedValue(payment({ status: "SUCCESSFUL" }));
    expect(await settleRentPayment("RNT-ch1-abc", "PAYSTACK", 500000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("does nothing twice when another request settles it first", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
    await settleRentPayment("RNT-ch1-abc", "PAYSTACK", 500000, {}, "NGN");
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("refuses wrong amounts, currencies, providers and unknown references", async () => {
    m.paymentFind.mockResolvedValue(payment());
    expect(await settleRentPayment("RNT-ch1-abc", "PAYSTACK", 100, {}, "NGN")).toMatchObject({ success: false, error: "Payment amount mismatch." });
    expect(await settleRentPayment("RNT-ch1-abc", "PAYSTACK", 500000, {}, "USD")).toMatchObject({ success: false, error: "Payment currency mismatch." });
    expect(await settleRentPayment("RNT-ch1-abc", "FLUTTERWAVE", 500000, {}, "NGN")).toMatchObject({ success: false, error: "Payment provider mismatch." });
    m.paymentFind.mockResolvedValue(payment({ purpose: "TRAVEL_BOOKING" }));
    expect(await settleRentPayment("RNT-ch1-abc", "PAYSTACK", 500000, {}, "NGN")).toMatchObject({ success: false });
    expect(m.receipt).not.toHaveBeenCalled();
  });

  it("flags a refund instead of double counting when the charge was already paid", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.receipt.mockResolvedValue(null);
    expect(await settleRentPayment("RNT-ch1-abc", "PAYSTACK", 500000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.tx.payment.update).toHaveBeenCalled();
    expect(m.warn).toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
    expect(m.notify.mock.calls[0][0].title).toMatch(/refund/i);
  });
});
