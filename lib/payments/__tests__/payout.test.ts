import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  paymentFind: vi.fn(),
  payoutCreate: vi.fn(),
  payoutFind: vi.fn(),
  payoutFindMany: vi.fn(),
  payoutUpdate: vi.fn(),
  payoutUpdateMany: vi.fn(),
  storeUpdate: vi.fn(),
  createRecipient: vi.fn(),
  balance: vi.fn(),
  transfer: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: { findUnique: m.paymentFind },
    payout: { create: m.payoutCreate, findUnique: m.payoutFind, findMany: m.payoutFindMany, update: m.payoutUpdate, updateMany: m.payoutUpdateMany },
    store: { update: m.storeUpdate },
  },
}));
vi.mock("@/lib/payments/paystack", () => ({
  createPaystackTransferRecipient: m.createRecipient,
  getPaystackBalanceKobo: m.balance,
  initiatePaystackTransfer: m.transfer,
  verifyPaystackTransfer: m.verify,
}));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error { code = "P2002"; } },
}));

import { classifyTransferStatus, payoutReference, processPayout, queuePayoutForPayment, retryDelayMs, toKobo } from "@/lib/payments/payout";

const payment = {
  id: "pay1",
  status: "SUCCESSFUL",
  storeId: "s1",
  purpose: "ORDER",
  provider: "PAYSTACK",
  amount: 12500,
  currency: "NGN",
  splitSubaccountCode: null,
  order: { commission: 0 },
  store: { id: "s1", payoutBankCode: "058", payoutAccountNumber: "0123456789", payoutDetails: { accountName: "Ada Stores" } },
};

const queued = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  status: "QUEUED",
  attempts: 0,
  amount: 12500,
  reference: "bnp-p1",
  nextAttemptAt: null,
  updatedAt: new Date(),
  store: { id: "s1", name: "Ada Stores", payoutBankCode: "058", payoutAccountNumber: "0123456789", paystackRecipientCode: "RCP_1", payoutDetails: null },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.payoutCreate.mockResolvedValue({});
  m.payoutUpdate.mockResolvedValue({});
  m.payoutUpdateMany.mockResolvedValue({ count: 1 });
  m.balance.mockResolvedValue({ status: true, message: "ok", balanceKobo: 10_000_000 });
});

describe("helpers", () => {
  it("builds a Paystack-valid reference and kobo amounts", () => {
    expect(payoutReference("ABC123def")).toBe("bnp-abc123def");
    expect(payoutReference("a".repeat(32)).length).toBeLessThanOrEqual(50);
    expect(toKobo(12500.5)).toBe(1250050);
  });
  it("backs off and caps retries", () => {
    expect(retryDelayMs(1)).toBe(15 * 60_000);
    expect(retryDelayMs(2)).toBe(30 * 60_000);
    expect(retryDelayMs(50)).toBe(6 * 60 * 60_000);
  });
  it("maps transfer statuses", () => {
    expect(classifyTransferStatus("success")).toBe("PAID");
    expect(classifyTransferStatus("pending")).toBe("PROCESSING");
    expect(classifyTransferStatus("otp")).toBe("OTP");
    expect(classifyTransferStatus("reversed")).toBe("REVERSED");
  });
});

describe("queuePayoutForPayment", () => {
  it("queues the FULL amount the customer paid (no commission)", async () => {
    m.paymentFind.mockResolvedValue(payment);
    const r = await queuePayoutForPayment("o1");
    expect(r.payoutId).toBeTruthy();
    expect(m.payoutCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 12500, status: "QUEUED", paymentId: "pay1", storeId: "s1" }) });
  });

  it("skips payments the gateway already split to a vendor subaccount", async () => {
    m.paymentFind.mockResolvedValue({ ...payment, splitSubaccountCode: "ACCT_x" });
    expect((await queuePayoutForPayment("o1")).skipped).toMatch(/split/);
    expect(m.payoutCreate).not.toHaveBeenCalled();
  });

  it("skips subscription payments and unsuccessful payments", async () => {
    m.paymentFind.mockResolvedValue({ ...payment, purpose: "SUBSCRIPTION_UPGRADE" });
    expect((await queuePayoutForPayment("x")).skipped).toBeTruthy();
    m.paymentFind.mockResolvedValue({ ...payment, status: "PENDING" });
    expect((await queuePayoutForPayment("x")).skipped).toBeTruthy();
    expect(m.payoutCreate).not.toHaveBeenCalled();
  });

  it("keeps the payout queued (not lost) when the store has no bank account yet", async () => {
    m.paymentFind.mockResolvedValue({ ...payment, store: { ...payment.store, payoutBankCode: null, payoutAccountNumber: null } });
    await queuePayoutForPayment("o1");
    expect(m.payoutCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "QUEUED", lastError: expect.stringMatching(/bank account/) }) });
  });

  it("flags Flutterwave payments for manual payout instead of pretending", async () => {
    m.paymentFind.mockResolvedValue({ ...payment, provider: "FLUTTERWAVE" });
    await queuePayoutForPayment("o1");
    expect(m.payoutCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "FAILED" }) });
  });

  it("is idempotent when a webhook and a callback race", async () => {
    m.paymentFind.mockResolvedValue(payment);
    m.payoutFind.mockResolvedValue({ id: "existing" });
    const { Prisma } = await import("@prisma/client");
    m.payoutCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup"));
    const r = await queuePayoutForPayment("o1");
    expect(r).toEqual({ payoutId: "existing", skipped: "payout already exists" });
  });
});

describe("processPayout", () => {
  it("transfers the full amount in kobo using a deterministic reference", async () => {
    m.payoutFind.mockResolvedValue(queued());
    m.transfer.mockResolvedValue({ status: true, message: "ok", data: { transfer_code: "TRF_1", status: "success", reference: "bnp-p1", amount: 1250000 } });
    const r = await processPayout("p1");
    expect(m.transfer).toHaveBeenCalledWith(expect.objectContaining({ amountKobo: 1_250_000, recipientCode: "RCP_1", reference: "bnp-p1" }));
    expect(m.payoutUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ status: "PAID" }) });
    expect(r.state).toBe("PAID");
  });

  it("does not send when the platform balance is short; stays queued without using an attempt", async () => {
    m.payoutFind.mockResolvedValue(queued());
    m.balance.mockResolvedValue({ status: true, message: "ok", balanceKobo: 100 });
    const r = await processPayout("p1");
    expect(m.transfer).not.toHaveBeenCalled();
    expect(m.payoutUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ status: "QUEUED", attempts: { decrement: 1 } }) });
    expect(r.state).toBe("QUEUED");
  });

  it("never double-sends: a retry first asks Paystack whether the reference already exists", async () => {
    m.payoutFind.mockResolvedValue(queued({ attempts: 1 }));
    m.verify.mockResolvedValue({ status: true, message: "ok", data: { transfer_code: "TRF_1", status: "success", reference: "bnp-p1", amount: 1250000 } });
    const r = await processPayout("p1");
    expect(m.transfer).not.toHaveBeenCalled();
    expect(r.state).toBe("PAID");
  });

  it("only one concurrent caller can claim an attempt", async () => {
    m.payoutFind.mockResolvedValue(queued());
    m.payoutUpdateMany.mockResolvedValue({ count: 0 });
    expect((await processPayout("p1")).state).toBe("SKIPPED");
    expect(m.transfer).not.toHaveBeenCalled();
  });

  it("registers a recipient on the fly when the store has none", async () => {
    m.payoutFind.mockResolvedValue(queued({ store: { ...queued().store, paystackRecipientCode: null, payoutDetails: { accountName: "Ada Stores" } } }));
    m.createRecipient.mockResolvedValue({ status: true, message: "ok", data: { recipient_code: "RCP_new" } });
    m.transfer.mockResolvedValue({ status: true, message: "ok", data: { transfer_code: "TRF_2", status: "pending", reference: "bnp-p1", amount: 1250000 } });
    const r = await processPayout("p1");
    expect(m.storeUpdate).toHaveBeenCalledWith({ where: { id: "s1" }, data: { paystackRecipientCode: "RCP_new" } });
    expect(r.state).toBe("PROCESSING");
  });

  it("marks FAILED loudly when Paystack asks for an OTP", async () => {
    m.payoutFind.mockResolvedValue(queued());
    m.transfer.mockResolvedValue({ status: true, message: "ok", data: { transfer_code: "TRF_3", status: "otp", reference: "bnp-p1", amount: 1250000 } });
    const r = await processPayout("p1");
    expect(r.state).toBe("OTP");
    expect(m.payoutUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ status: "FAILED", lastError: expect.stringMatching(/OTP/) }) });
  });

  it("retries later after a network error instead of failing", async () => {
    m.payoutFind.mockResolvedValue(queued());
    m.transfer.mockRejectedValue(new Error("socket hang up"));
    const r = await processPayout("p1");
    expect(r.state).toBe("QUEUED");
    expect(m.payoutUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ status: "QUEUED", lastError: "socket hang up" }) });
  });
});
