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
  flwTransfer: vi.fn(),
  flwFind: vi.fn(),
  flwBalance: vi.fn(),
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
vi.mock("@/lib/payments/flutterwave", () => ({
  initiateFlutterwaveTransfer: m.flwTransfer,
  findFlutterwaveTransferByReference: m.flwFind,
  getFlutterwaveBalanceNaira: m.flwBalance,
}));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error { code = "P2002"; } },
}));

import { applyFlutterwaveTransferWebhookEvent, applyTransferWebhookEvent, classifyTransferStatus, isTransferEvent, markPayoutPaidManually, payoutReference, processPayout, queuePayoutForPayment, retryDelayMs, retryPayout, toKobo } from "@/lib/payments/payout";

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
  m.flwBalance.mockResolvedValue({ status: true, message: "ok", balanceNaira: 100_000 });
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
    // Flutterwave statuses
    expect(classifyTransferStatus("SUCCESSFUL")).toBe("PAID");
    expect(classifyTransferStatus("FAILED")).toBe("FAILED");
    expect(classifyTransferStatus("NEW")).toBe("PROCESSING");
    expect(classifyTransferStatus("PENDING")).toBe("PROCESSING");
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

  it("queues Flutterwave payments for an automated Flutterwave transfer", async () => {
    m.paymentFind.mockResolvedValue({ ...payment, provider: "FLUTTERWAVE" });
    await queuePayoutForPayment("o1");
    expect(m.payoutCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "FLUTTERWAVE",
        status: "QUEUED",
        amount: 12500,
        destination: expect.objectContaining({ transferGateway: "FLUTTERWAVE" }),
      }),
    });
  });

  it("pins Paystack payments to a Paystack transfer", async () => {
    m.paymentFind.mockResolvedValue(payment);
    await queuePayoutForPayment("o1");
    expect(m.payoutCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ destination: expect.objectContaining({ transferGateway: "PAYSTACK" }) }) });
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

describe("wallet payments", () => {
  it("queues a payout for a booking paid from a customer wallet", async () => {
    m.paymentFind.mockResolvedValue({ ...payment, purpose: "SERVICE_BOOKING", provider: "WALLET", order: null });
    const r = await queuePayoutForPayment("WALPAY-b1");
    expect(r.payoutId).toBeTruthy();
    expect(m.payoutCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ provider: "WALLET", status: "QUEUED", amount: 12500 }) });
  });

  it("ignores cash/POS payments: nothing for the platform to transfer", async () => {
    m.paymentFind.mockResolvedValue({ ...payment, provider: "CASH" });
    expect((await queuePayoutForPayment("pos1")).skipped).toMatch(/outside/);
    expect(m.payoutCreate).not.toHaveBeenCalled();
  });
});

describe("refunded payments", () => {
  it("never sends a queued payout whose payment was refunded", async () => {
    m.payoutFind.mockResolvedValue(queued({ payment: { status: "REFUNDED" } }));
    const r = await processPayout("p1");
    expect(r.state).toBe("FAILED");
    expect(m.transfer).not.toHaveBeenCalled();
    expect(m.payoutUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
});

describe("admin recovery", () => {
  const failed = { id: "p1", status: "FAILED", provider: "PAYSTACK", reference: "bnp-p1" };

  it("rotates the reference and resends only after Paystack confirms the old transfer failed", async () => {
    m.payoutFind.mockResolvedValueOnce(failed).mockResolvedValueOnce(queued({ payment: { status: "SUCCESSFUL" } }));
    m.verify.mockResolvedValue({ status: true, message: "ok", data: { status: "failed", transfer_code: "TRF_1" } });
    m.transfer.mockResolvedValue({ status: true, message: "ok", data: { transfer_code: "TRF_2", status: "pending" } });
    const r = await retryPayout("p1");
    expect(r.ok).toBe(true);
    const rotated = m.payoutUpdate.mock.calls.find((c) => c[0].data.reference)?.[0].data.reference as string;
    expect(rotated).toMatch(/^bnp-p1-r/);
    expect(rotated.length).toBeLessThanOrEqual(50);
  });

  it("does NOT resend when the old transfer actually succeeded", async () => {
    m.payoutFind.mockResolvedValueOnce(failed);
    m.verify.mockResolvedValue({ status: true, message: "ok", data: { status: "success", transfer_code: "TRF_1" } });
    const r = await retryPayout("p1");
    expect(r.ok).toBe(false);
    expect(m.transfer).not.toHaveBeenCalled();
    expect(m.payoutUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }));
  });

  it("refuses to retry when Paystack can't be reached (unknown state)", async () => {
    m.payoutFind.mockResolvedValueOnce(failed);
    m.verify.mockResolvedValue({ status: false, message: "Network error" });
    expect((await retryPayout("p1")).ok).toBe(false);
    expect(m.transfer).not.toHaveBeenCalled();
  });

  it("won't retry a payment method that isn't automated", async () => {
    m.payoutFind.mockResolvedValueOnce({ ...failed, provider: "CASH" });
    expect((await retryPayout("p1")).ok).toBe(false);
    expect(m.verify).not.toHaveBeenCalled();
  });

  it("requires a note to mark a payout paid manually", async () => {
    expect((await markPayoutPaidManually("p1", "  ")).ok).toBe(false);
    expect(m.payoutUpdateMany).not.toHaveBeenCalled();
    expect((await markPayoutPaidManually("p1", "GTB ref 123")).ok).toBe(true);
  });
});

describe("Flutterwave payouts", () => {
  const flwPayout = (over: Record<string, unknown> = {}) =>
    queued({ provider: "FLUTTERWAVE", destination: { transferGateway: "FLUTTERWAVE" }, ...over });

  it("sends bank details + naira amount straight from the Flutterwave balance (no recipient step)", async () => {
    m.payoutFind.mockResolvedValue(flwPayout());
    m.flwTransfer.mockResolvedValue({ status: "success", message: "ok", data: { id: 9001, reference: "bnp-p1", status: "NEW", amount: 12500 } });
    const r = await processPayout("p1");
    expect(m.createRecipient).not.toHaveBeenCalled();
    expect(m.transfer).not.toHaveBeenCalled();
    expect(m.flwTransfer).toHaveBeenCalledWith(expect.objectContaining({ bankCode: "058", accountNumber: "0123456789", amountNaira: 12500, reference: "bnp-p1" }));
    expect(m.payoutUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ status: "PROCESSING", gatewayTransferId: "9001" }) });
    expect(r.state).toBe("PROCESSING");
  });

  it("records an instantly successful transfer as PAID", async () => {
    m.payoutFind.mockResolvedValue(flwPayout());
    m.flwTransfer.mockResolvedValue({ status: "success", message: "ok", data: { id: 9002, reference: "bnp-p1", status: "SUCCESSFUL", amount: 12500 } });
    expect((await processPayout("p1")).state).toBe("PAID");
  });

  it("checks the Flutterwave balance, not Paystack's, and waits when it is short", async () => {
    m.payoutFind.mockResolvedValue(flwPayout());
    m.flwBalance.mockResolvedValue({ status: true, message: "ok", balanceNaira: 10 });
    const r = await processPayout("p1");
    expect(m.balance).not.toHaveBeenCalled();
    expect(m.flwTransfer).not.toHaveBeenCalled();
    expect(r.state).toBe("QUEUED");
  });

  it("never double-sends: a retry looks the reference up on Flutterwave first (exact match only)", async () => {
    m.payoutFind.mockResolvedValue(flwPayout({ attempts: 1 }));
    m.flwFind.mockResolvedValue({ status: "success", message: "ok", data: [{ id: 1, reference: "someone-else", status: "FAILED", amount: 1 }, { id: 9003, reference: "bnp-p1", status: "SUCCESSFUL", amount: 12500 }] });
    const r = await processPayout("p1");
    expect(m.flwTransfer).not.toHaveBeenCalled();
    expect(r.state).toBe("PAID");
  });

  it("adopts the existing transfer when Flutterwave rejects a duplicate reference", async () => {
    m.payoutFind.mockResolvedValue(flwPayout());
    m.flwTransfer.mockResolvedValue({ status: "error", message: "Duplicate reference" });
    m.flwFind.mockResolvedValue({ status: "success", message: "ok", data: [{ id: 9004, reference: "bnp-p1", status: "PENDING", amount: 12500 }] });
    expect((await processPayout("p1")).state).toBe("PROCESSING");
  });

  it("keeps the payout queued (not failed) when Flutterwave rejects the server IP", async () => {
    m.payoutFind.mockResolvedValue(flwPayout());
    m.flwTransfer.mockResolvedValue({ status: "error", message: "Your IP address is not whitelisted" });
    const r = await processPayout("p1");
    expect(r.state).toBe("QUEUED");
    expect(m.payoutUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ status: "QUEUED", attempts: { decrement: 1 } }) });
  });

  it("does not resend a stuck payout when Flutterwave can't be reached (unknown state)", async () => {
    m.payoutFind.mockResolvedValue(flwPayout({ status: "PROCESSING", updatedAt: new Date(Date.now() - 3_600_000) }));
    m.flwFind.mockResolvedValue({ status: "error", message: "Network error", data: [] });
    const r = await processPayout("p1");
    expect(r.state).toBe("SKIPPED");
    expect(m.flwTransfer).not.toHaveBeenCalled();
  });

  it("retryPayout resends a failed Flutterwave transfer only after Flutterwave confirms it failed", async () => {
    m.payoutFind.mockResolvedValueOnce({ id: "p1", status: "FAILED", provider: "FLUTTERWAVE", reference: "bnp-p1", destination: { transferGateway: "FLUTTERWAVE" } });
    m.flwFind.mockResolvedValue({ status: "success", message: "ok", data: [{ id: 5, reference: "bnp-p1", status: "FAILED", amount: 12500 }] });
    m.payoutFind.mockResolvedValue(flwPayout());
    m.flwTransfer.mockResolvedValue({ status: "success", message: "ok", data: { id: 6, reference: "bnp-p1-rx", status: "NEW", amount: 12500 } });
    const r = await retryPayout("p1");
    expect(r.ok).toBe(true);
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.payoutUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: expect.objectContaining({ status: "QUEUED", reference: expect.stringMatching(/^bnp-p1-r/) }) });
  });

  it("maps transfer.completed onto the same safe transition rules", async () => {
    expect(await applyFlutterwaveTransferWebhookEvent({ id: 7, reference: "bnp-p1", status: "SUCCESSFUL" }, {})).toBe(true);
    expect(m.payoutUpdateMany.mock.calls[0][0].data).toEqual(expect.objectContaining({ status: "PAID", gatewayTransferId: "7" }));
    m.payoutUpdateMany.mockClear();
    await applyFlutterwaveTransferWebhookEvent({ id: 7, reference: "bnp-p1", status: "FAILED", complete_message: "Account closed" }, {});
    expect(m.payoutUpdateMany.mock.calls[0][0]).toEqual(expect.objectContaining({ where: { reference: "bnp-p1", status: { in: ["QUEUED", "PROCESSING"] } } }));
  });

  it("ignores non-final transfer.completed statuses", async () => {
    expect(await applyFlutterwaveTransferWebhookEvent({ id: 7, reference: "bnp-p1", status: "PENDING" }, {})).toBe(false);
    expect(m.payoutUpdateMany).not.toHaveBeenCalled();
  });
});

describe("transfer webhooks", () => {
  const where = () => m.payoutUpdateMany.mock.calls[0][0].where as { reference: string; status: { in: string[] } };

  it("a late transfer.failed can never undo a payout that already went through", async () => {
    await applyTransferWebhookEvent("transfer.failed", { reference: "bnp-p1", reason: "x" }, {});
    expect(where().status.in).toEqual(["QUEUED", "PROCESSING"]);
    expect(where().status.in).not.toContain("PAID");
  });

  it("a repeated transfer.success does not rewrite an already paid payout", async () => {
    await applyTransferWebhookEvent("transfer.success", { reference: "bnp-p1" }, {});
    expect(where().status.in).not.toContain("PAID");
  });

  it("still lets a reversal land on a paid payout (money came back)", async () => {
    await applyTransferWebhookEvent("transfer.reversed", { reference: "bnp-p1" }, {});
    expect(where().status.in).toContain("PAID");
  });

  it("ignores events with no reference and unrelated event names", async () => {
    expect(await applyTransferWebhookEvent("transfer.success", {}, {})).toBe(false);
    expect(m.payoutUpdateMany).not.toHaveBeenCalled();
    expect(isTransferEvent("charge.success")).toBe(false);
  });
});
