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
vi.mock("@/lib/payments/ticket-receipt", () => ({ markTicketOrderPaid: m.receipt }));
vi.mock("@/lib/payments/ticket-confirmation", () => ({ sendTicketEmail: m.email }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/utils/format-money", () => ({ formatMoney: (n: number) => `NGN ${n}` }));

import { settleTicketPayment } from "@/lib/payments/settle-ticket";

function payment(over: Record<string, unknown> = {}) {
  return {
    id: "pay1", reference: "TKT-o1-abc", purpose: "TICKET_PURCHASE", provider: "PAYSTACK", status: "PENDING", amount: "10000", currency: "NGN",
    ticketOrder: { id: "o1", storeId: "s1", buyerName: "Test Buyer", accessToken: "tok", event: { title: "Night Market" }, store: { id: "s1", slug: "fest", business: { user: { id: "owner1" } } } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  m.receipt.mockResolvedValue("RCT-000001");
});

describe("settleTicketPayment", () => {
  it("issues tickets, emails the buyer, notifies the store and returns the tickets page", async () => {
    m.paymentFind.mockResolvedValue(payment());
    const r = await settleTicketPayment("TKT-o1-abc", "PAYSTACK", 10000, {}, "NGN");
    expect(r).toMatchObject({ success: true, data: { storeSlug: "fest", redirectPath: "/store/fest/ticket/tok" } });
    expect(m.receipt).toHaveBeenCalledWith(m.tx, expect.objectContaining({ orderId: "o1", storeId: "s1", method: "CARD", reference: "TKT-o1-abc" }));
    expect(m.email).toHaveBeenCalledWith("TKT-o1-abc");
    expect(m.notify.mock.calls[0][0]).toMatchObject({ userId: "owner1", type: "TICKET_PURCHASE" });
    expect(m.payout).toHaveBeenCalled();
  });

  it("is idempotent for replayed webhooks", async () => {
    m.paymentFind.mockResolvedValue(payment({ status: "SUCCESSFUL" }));
    expect(await settleTicketPayment("TKT-o1-abc", "PAYSTACK", 10000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("does nothing when another request settles it first", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
    await settleTicketPayment("TKT-o1-abc", "PAYSTACK", 10000, {}, "NGN");
    expect(m.receipt).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("refuses wrong amounts, currencies, providers and purposes", async () => {
    m.paymentFind.mockResolvedValue(payment());
    expect(await settleTicketPayment("TKT-o1-abc", "PAYSTACK", 100, {}, "NGN")).toMatchObject({ success: false, error: "Payment amount mismatch." });
    expect(await settleTicketPayment("TKT-o1-abc", "PAYSTACK", 10000, {}, "USD")).toMatchObject({ success: false, error: "Payment currency mismatch." });
    expect(await settleTicketPayment("TKT-o1-abc", "KORAPAY", 10000, {}, "NGN")).toMatchObject({ success: false, error: "Payment provider mismatch." });
    m.paymentFind.mockResolvedValue(payment({ purpose: "MEMBER_PAYMENT" }));
    expect(await settleTicketPayment("TKT-o1-abc", "PAYSTACK", 10000, {}, "NGN")).toMatchObject({ success: false });
    expect(m.receipt).not.toHaveBeenCalled();
  });

  it("flags a refund instead of issuing tickets when the order had expired", async () => {
    m.paymentFind.mockResolvedValue(payment());
    m.receipt.mockResolvedValue(null);
    expect(await settleTicketPayment("TKT-o1-abc", "PAYSTACK", 10000, {}, "NGN")).toMatchObject({ success: true });
    expect(m.tx.payment.update).toHaveBeenCalled();
    expect(m.warn).toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
    expect(m.notify.mock.calls[0][0].title).toMatch(/refund/i);
  });
});
