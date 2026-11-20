import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  account: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  pending: vi.fn(),
  settle: vi.fn(),
  flwVerify: vi.fn(),
  koraVerify: vi.fn(),
  psVerify: vi.fn(),
  intentFind: vi.fn(),
  claim: vi.fn(),
  match: vi.fn(),
  settleOrder: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { storeVirtualAccount: { findFirst: (a: unknown) => (m.pending(a), m.account(a)), update: m.update }, payment: { create: m.create }, storeTransferIntent: { findFirst: m.intentFind, updateMany: m.claim } },
}));
vi.mock("@/lib/payments/transfer-intent", () => ({ findMatchingIntent: m.match }));
vi.mock("@/lib/payments/settle-order", () => ({ settleOrderPayment: m.settleOrder }));
vi.mock("@/lib/payments/payout", () => ({ settleAndPayout: m.settle }));
vi.mock("@/lib/payments/flutterwave", () => ({ verifyFlutterwaveTransaction: m.flwVerify }));
vi.mock("@/lib/payments/korapay", () => ({ verifyKorapayTransaction: m.koraVerify }));
vi.mock("@/lib/payments/paystack", () => ({ verifyPaystackTransaction: m.psVerify }));

import { settleStoreTransfer } from "@/lib/payments/settle-store-transfer";
import { handleFlutterwaveVirtualAccount, handleKorapayVirtualAccount, handlePaystackVirtualAccount } from "@/lib/payments/virtual-account-webhook";

beforeEach(() => {
  vi.clearAllMocks();
  m.account.mockResolvedValue({ id: "va1", storeId: "s1" });
  m.create.mockResolvedValue({});
  m.settle.mockResolvedValue(undefined);
  m.intentFind.mockResolvedValue(null);
  m.match.mockResolvedValue(null);
  m.claim.mockResolvedValue({ count: 1 });
  m.settleOrder.mockResolvedValue({ outcome: "paid" });
});

describe("settleStoreTransfer", () => {
  it("records a successful STORE_TRANSFER payment and queues the payout", async () => {
    const r = await settleStoreTransfer({ provider: "FLUTTERWAVE" as never, accountReference: "VA-1", gatewayReference: "123", verifiedAmountNaira: 5000, rawPayload: {} });
    expect(r.ok).toBe(true);
    const data = m.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ storeId: "s1", purpose: "STORE_TRANSFER", status: "SUCCESSFUL", amount: 5000, reference: "VAT-FLU-123" });
    expect(m.settle).toHaveBeenCalledWith("VAT-FLU-123");
  });
  it("is idempotent on a webhook retry (duplicate reference) and still finishes the payout", async () => {
    m.create.mockRejectedValue({ code: "P2002" });
    expect((await settleStoreTransfer({ provider: "KORAPAY" as never, accountNumber: "7650000001", gatewayReference: "k1", verifiedAmountNaira: 100, rawPayload: {} })).ok).toBe(true);
    expect(m.settle).toHaveBeenCalledTimes(1);
  });
  it("ignores an unknown account and a zero amount", async () => {
    m.account.mockResolvedValue(null);
    expect((await settleStoreTransfer({ provider: "PAYSTACK" as never, accountNumber: "1", gatewayReference: "x", verifiedAmountNaira: 50, rawPayload: {} })).ok).toBe(false);
    m.account.mockResolvedValue({ id: "va1", storeId: "s1" });
    expect((await settleStoreTransfer({ provider: "PAYSTACK" as never, accountNumber: "1", gatewayReference: "x", verifiedAmountNaira: 0, rawPayload: {} })).ok).toBe(false);
    expect(m.create).not.toHaveBeenCalled();
  });
});

describe("transfer matched to a checkout order", () => {
  const base = { provider: "FLUTTERWAVE" as never, accountReference: "VA-1", gatewayReference: "g1", verifiedAmountNaira: 5000.07, rawPayload: {} };
  it("pays the waiting order and records no loose store transfer", async () => {
    m.match.mockResolvedValue({ id: "i1", orderId: "o1" });
    expect((await settleStoreTransfer(base)).ok).toBe(true);
    expect(m.claim).toHaveBeenCalledWith({ where: { id: "i1", status: "OPEN" }, data: { status: "PAID", gatewayReference: "g1" } });
    expect(m.settleOrder).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o1", reference: "o1", verifiedAmountNaira: 5000.07 }));
    expect(m.create).not.toHaveBeenCalled();
  });
  it("a webhook retry for an already-paid order does not pay the vendor twice", async () => {
    m.intentFind.mockResolvedValue({ orderId: "o1" });
    m.settleOrder.mockResolvedValue({ outcome: "already_paid" });
    expect((await settleStoreTransfer(base)).ok).toBe(true);
    expect(m.match).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
  it("falls back to a loose store transfer when the order can't take it, so the vendor is still paid", async () => {
    m.match.mockResolvedValue({ id: "i1", orderId: "o1" });
    m.settleOrder.mockResolvedValue({ outcome: "mismatch" });
    expect((await settleStoreTransfer(base)).ok).toBe(true);
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it("two racing webhooks cannot both claim the same order", async () => {
    m.match.mockResolvedValue({ id: "i1", orderId: "o1" });
    m.claim.mockResolvedValue({ count: 0 });
    await settleStoreTransfer(base);
    expect(m.settleOrder).not.toHaveBeenCalled();
  });
});

describe("webhook handlers", () => {
  it("Flutterwave: settles a credit to a known account after re-verifying, skips other charges", async () => {
    expect(await handleFlutterwaveVirtualAccount({ event: "transfer.completed" })).toBeNull();
    m.account.mockResolvedValueOnce(null);
    expect(await handleFlutterwaveVirtualAccount({ event: "charge.completed", data: { id: 9, tx_ref: "ORD-1" } })).toBeNull();
    m.flwVerify.mockResolvedValue({ status: "success", data: { status: "successful", amount: 2500 } });
    const res = await handleFlutterwaveVirtualAccount({ event: "charge.completed", data: { id: 9, tx_ref: "VA-1" } });
    expect(res?.status).toBe(200);
    expect(m.create.mock.calls[0][0].data.amount).toBe(2500);
  });
  it("Flutterwave: asks for a retry when the gateway can't be reached, and ignores unsuccessful charges", async () => {
    m.flwVerify.mockResolvedValue({ status: "error" });
    expect((await handleFlutterwaveVirtualAccount({ event: "charge.completed", data: { id: 9, tx_ref: "VA-1" } }))?.status).toBe(502);
    m.flwVerify.mockResolvedValue({ status: "success", data: { status: "failed", amount: 2500 } });
    expect((await handleFlutterwaveVirtualAccount({ event: "charge.completed", data: { id: 9, tx_ref: "VA-1" } }))?.status).toBe(200);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("Korapay: only handles virtual-account charges, and pays out the verified amount", async () => {
    expect(await handleKorapayVirtualAccount({ event: "charge.success", data: { reference: "r1" } })).toBeNull();
    m.koraVerify.mockResolvedValue({ status: "success", data: { status: "successful", amount: 1000 } });
    const res = await handleKorapayVirtualAccount({ event: "charge.success", data: { reference: "r1", virtual_bank_account_details: { virtual_bank_account: { account_number: "7650000001" } } } });
    expect(res?.status).toBe(200);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ amount: 1000, provider: "KORAPAY" });
  });
  it("Paystack: converts kobo to naira, only for dedicated_nuban credits, and activates a pending account", async () => {
    expect(await handlePaystackVirtualAccount({ event: "charge.success", data: { channel: "card", reference: "p1" } })).toBeNull();
    m.psVerify.mockResolvedValue({ status: true, data: { status: "success", amount: 750000 } });
    await handlePaystackVirtualAccount({ event: "charge.success", data: { channel: "dedicated_nuban", reference: "p1", authorization: { receiver_bank_account_number: "9900000001" } } });
    expect(m.create.mock.calls[0][0].data.amount).toBe(7500);
    m.account.mockResolvedValue({ id: "va2" });
    await handlePaystackVirtualAccount({ event: "dedicatedaccount.assign.success", data: { customer: { email: "A@B.com" }, dedicated_account: { account_number: "9900000002", account_name: "ACME", bank: { name: "Wema Bank" } } } });
    expect(m.update.mock.calls[0][0].data).toMatchObject({ accountNumber: "9900000002", status: "ACTIVE" });
  });
});
