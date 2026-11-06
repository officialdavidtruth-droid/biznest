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
vi.mock("@/lib/payments/job-receipt", () => ({ markJobChargePaid: m.receipt }));
vi.mock("@/lib/payments/job-confirmation", () => ({ sendJobReceiptEmail: m.email }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/utils/format-money", () => ({ formatMoney: (n: number) => `NGN ${n}` }));

import { settleJobPayment } from "@/lib/payments/settle-job";

function payment(over: Record<string, unknown> = {}) {
  return {
    id: "pay1", reference: "JBC-c1-abc", purpose: "JOB_PAYMENT", provider: "PAYSTACK", status: "PENDING", amount: "10000", currency: "NGN",
    jobCharge: { id: "c1", storeId: "s1", label: "Deposit (50%)", job: { jobNo: "JOB-00001", customerName: "Test Buyer", accessToken: "tok" }, store: { id: "s1", slug: "fest", business: { user: { id: "owner1" } } } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  m.receipt.mockResolvedValue("RCT-000001");
});

describe("settleJobPayment", () => {
  it("marks the charge paid, emails a receipt, notifies the store and returns the job page", async () => {
    m.paymentFind.mockResolvedValue(payment());
    const r = await settleJobPayment("JBC-c1-abc", "PAYSTACK", 10000, {}, "NGN");
    expect(r).toMatchObject({ success: true, data: { storeSlug: "fest", redirectPath: "/store/fest/job/tok" } });
    expect(m.receipt).toHaveBeenCalledWith(m.tx, expect.objectContaining({ chargeId: "c1", storeId: "s1", method: "CARD", reference: "JBC-c1-abc" }));
    expect(m.email).toHaveBeenCalledWith("JBC-c1-abc");
    expect(m.notify.mock.calls[0][0]).toMatchObject({ userId: "owner1", type: "JOB_PAYMENT" });
    expect(m.payout).toHaveBeenCalled();
  });

  it("is idempotent for replayed webhooks", async () => {
    m.paymentFind.mockResolvedValue(payment({ status: "SUCCESSFUL" }));
    expect(await settleJobPayment("JBC-c1-abc", "PAYSTACK", 10000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("does nothing when another request settles it first", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
    await settleJobPayment("JBC-c1-abc", "PAYSTACK", 10000, {}, "NGN");
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("refuses wrong amounts, currencies, providers and purposes", async () => {
    m.paymentFind.mockResolvedValue(payment());
    expect(await settleJobPayment("JBC-c1-abc", "PAYSTACK", 100, {}, "NGN")).toMatchObject({ success: false, error: "Payment amount mismatch." });
    expect(await settleJobPayment("JBC-c1-abc", "PAYSTACK", 10000, {}, "USD")).toMatchObject({ success: false, error: "Payment currency mismatch." });
    expect(await settleJobPayment("JBC-c1-abc", "KORAPAY", 10000, {}, "NGN")).toMatchObject({ success: false, error: "Payment provider mismatch." });
    m.paymentFind.mockResolvedValue(payment({ purpose: "TICKET_PURCHASE" }));
    expect(await settleJobPayment("JBC-c1-abc", "PAYSTACK", 10000, {}, "NGN")).toMatchObject({ success: false });
    expect(m.receipt).not.toHaveBeenCalled();
  });

  it("flags a refund when the charge was already paid", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.receipt.mockResolvedValue(null);
    expect(await settleJobPayment("JBC-c1-abc", "PAYSTACK", 10000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.tx.payment.update).toHaveBeenCalled();
    expect(m.warn).toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
    expect(m.notify.mock.calls[0][0].title).toMatch(/refund/i);
  });
});
