import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = { adCampaign: { findFirst: vi.fn(), updateMany: vi.fn() }, payment: { updateMany: vi.fn(), findUnique: vi.fn() } };
  return { tx, paymentFind: vi.fn(), audit: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: { payment: { findUnique: m.paymentFind }, auditLog: { create: m.audit }, $transaction: (fn: (tx: typeof m.tx) => Promise<unknown>) => fn(m.tx) } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { settleAdPayment } from "@/lib/payments/settle-ad";

const REF = "ADS-cmp1-nonce123";
beforeEach(() => {
  vi.clearAllMocks();
  m.paymentFind.mockResolvedValue({ storeId: "s1", purpose: "AD_CAMPAIGN", amount: "5000" });
  m.tx.adCampaign.findFirst.mockResolvedValue({ id: "cmp1", status: "PENDING_PAYMENT", durationDays: 7, store: { slug: "acme-test" } });
  m.tx.payment.updateMany.mockResolvedValue({ count: 1 });
  m.tx.adCampaign.updateMany.mockResolvedValue({ count: 1 });
  m.audit.mockResolvedValue({});
});

describe("settleAdPayment", () => {
  it("activates the campaign for its duration and audits it", async () => {
    const before = Date.now();
    expect(await settleAdPayment(REF, 5000, {})).toEqual({ success: true, data: { slug: "acme-test" } });
    const call = m.tx.adCampaign.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "cmp1", status: "PENDING_PAYMENT" });
    expect(call.data.status).toBe("ACTIVE");
    expect(call.data.endsAt.getTime() - before).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(m.audit).toHaveBeenCalled();
  });
  it("is idempotent: a replay neither re-activates nor extends", async () => {
    m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
    m.tx.payment.findUnique.mockResolvedValue({ status: "SUCCESSFUL" });
    expect((await settleAdPayment(REF, 5000, {})).success).toBe(true);
    expect(m.tx.adCampaign.updateMany).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });
  it("refuses a short payment, a wrong purpose, a bad reference and an unknown campaign", async () => {
    expect((await settleAdPayment(REF, 100, {})).success).toBe(false);
    m.paymentFind.mockResolvedValue({ storeId: "s1", purpose: "PLUGIN_PURCHASE", amount: "5000" });
    expect((await settleAdPayment(REF, 5000, {})).success).toBe(false);
    expect((await settleAdPayment("PLUG-x-y-12345678", 5000, {})).success).toBe(false);
    m.paymentFind.mockResolvedValue({ storeId: "s1", purpose: "AD_CAMPAIGN", amount: "5000" });
    m.tx.adCampaign.findFirst.mockResolvedValue(null);
    expect((await settleAdPayment(REF, 5000, {})).success).toBe(false);
  });
  it("does not report an unpaid payment as settled", async () => {
    m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
    m.tx.payment.findUnique.mockResolvedValue({ status: "REFUNDED" });
    expect((await settleAdPayment(REF, 5000, {})).success).toBe(false);
  });
});
