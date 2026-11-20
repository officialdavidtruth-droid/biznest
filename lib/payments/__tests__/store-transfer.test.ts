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
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { storeVirtualAccount: { findFirst: (a: unknown) => (m.pending(a), m.account(a)), update: m.update }, payment: { create: m.create } },
}));
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
