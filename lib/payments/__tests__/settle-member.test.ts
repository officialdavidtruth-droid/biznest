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
vi.mock("@/lib/payments/member-receipt", () => ({ markMemberChargePaid: m.receipt }));
vi.mock("@/lib/payments/member-confirmation", () => ({ sendMemberReceiptEmail: m.email }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/utils/format-money", () => ({ formatMoney: (n: number) => `NGN ${n}` }));

import { settleMemberPayment } from "@/lib/payments/settle-member";

const store = { id: "s1", slug: "gym", business: { user: { id: "owner1" } } };
function payment(over: Record<string, unknown> = {}) {
  return {
    id: "pay1", reference: "MBR-ch1-abc", purpose: "MEMBER_PAYMENT", provider: "PAYSTACK", status: "PENDING", amount: "15000", currency: "NGN",
    memberCharge: { id: "ch1", storeId: "s1", kind: "DUES", label: "Monthly: Nov 2026", donorName: null, member: { name: "Test Person", portalToken: "tok" }, store },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  m.receipt.mockResolvedValue("RCT-000001");
});

describe("settleMemberPayment", () => {
  it("pays the charge, emails a receipt, notifies the store and returns the portal path", async () => {
    m.paymentFind.mockResolvedValue(payment());
    const r = await settleMemberPayment("MBR-ch1-abc", "PAYSTACK", 15000, {}, "NGN");
    expect(r).toMatchObject({ success: true, data: { storeSlug: "gym", redirectPath: "/store/gym/member/tok" } });
    expect(m.receipt).toHaveBeenCalledWith(m.tx, expect.objectContaining({ chargeId: "ch1", method: "CARD", reference: "MBR-ch1-abc" }));
    expect(m.email).toHaveBeenCalledWith("MBR-ch1-abc");
    expect(m.notify.mock.calls[0][0]).toMatchObject({ userId: "owner1", type: "MEMBER_PAYMENT" });
    expect(m.payout).toHaveBeenCalled();
  });

  it("sends anonymous gifts back to the giving page", async () => {
    m.paymentFind.mockResolvedValue(payment({ memberCharge: { id: "ch2", storeId: "s1", kind: "GIVING", label: "General", donorName: "Ada", member: null, store } }));
    const r = await settleMemberPayment("MBR-ch2-abc", "PAYSTACK", 15000, {}, "NGN");
    expect(r).toMatchObject({ success: true, data: { redirectPath: "/store/gym/give" } });
  });

  it("is idempotent for replayed webhooks", async () => {
    m.paymentFind.mockResolvedValue(payment({ status: "SUCCESSFUL" }));
    expect(await settleMemberPayment("MBR-ch1-abc", "PAYSTACK", 15000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("does nothing when another request settles it first", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
    await settleMemberPayment("MBR-ch1-abc", "PAYSTACK", 15000, {}, "NGN");
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("refuses wrong amounts, currencies, providers and purposes", async () => {
    m.paymentFind.mockResolvedValue(payment());
    expect(await settleMemberPayment("MBR-ch1-abc", "PAYSTACK", 100, {}, "NGN")).toMatchObject({ success: false, error: "Payment amount mismatch." });
    expect(await settleMemberPayment("MBR-ch1-abc", "PAYSTACK", 15000, {}, "USD")).toMatchObject({ success: false, error: "Payment currency mismatch." });
    expect(await settleMemberPayment("MBR-ch1-abc", "KORAPAY", 15000, {}, "NGN")).toMatchObject({ success: false, error: "Payment provider mismatch." });
    m.paymentFind.mockResolvedValue(payment({ purpose: "RENT_PAYMENT" }));
    expect(await settleMemberPayment("MBR-ch1-abc", "PAYSTACK", 15000, {}, "NGN")).toMatchObject({ success: false });
    expect(m.receipt).not.toHaveBeenCalled();
  });

  it("flags a refund when the charge was already paid", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.receipt.mockResolvedValue(null);
    expect(await settleMemberPayment("MBR-ch1-abc", "PAYSTACK", 15000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.tx.payment.update).toHaveBeenCalled();
    expect(m.warn).toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
    expect(m.notify.mock.calls[0][0].title).toMatch(/refund/i);
  });
});
