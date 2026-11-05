import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    storeWallet: { findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    payment: { findUnique: vi.fn(), count: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    order: { updateMany: vi.fn() },
    walletTransaction: { create: vi.fn() },
  };
  return {
    tx,
    prisma: { order: { findFirst: vi.fn() }, payment: { findUnique: vi.fn() }, $transaction: vi.fn() },
    decrementStockForOrder: vi.fn(),
    emitWebhookEvent: vi.fn(),
    postOrderSaleToLedger: vi.fn(),
    settleAndPayout: vi.fn(),
    notifyOwner: vi.fn(),
    notifyCustomer: vi.fn(),
    payable: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error { code = ""; } } }));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/payments/stock", () => ({ decrementStockForOrder: m.decrementStockForOrder }));
vi.mock("@/lib/webhooks/dispatch", () => ({ emitWebhookEvent: m.emitWebhookEvent }));
vi.mock("@/lib/notifications/notify", () => ({ notifyStoreOwnerOfPaidOrder: m.notifyOwner, notifyCustomerOfPaidOrder: m.notifyCustomer }));
vi.mock("@/lib/financial/order-ledger", () => ({ postOrderSaleToLedger: m.postOrderSaleToLedger }));
vi.mock("@/lib/payments/payout", () => ({ settleAndPayout: m.settleAndPayout }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn() }));
vi.mock("@/lib/payments/order-payable", () => ({ getOrderPayableNaira: m.payable }));

import { payOrderFromWallet } from "../pay-order-wallet";

const order = { id: "ord1", storeId: "s1", total: 5000, currency: "NGN", status: "PENDING_PAYMENT", paymentProvider: null, paymentProofUrl: null };

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.order.findFirst.mockResolvedValue(order);
  m.prisma.payment.findUnique.mockResolvedValue(null);
  m.payable.mockResolvedValue(5000);
  m.prisma.$transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
  m.tx.storeWallet.findUnique.mockResolvedValue({ id: "w1", status: "ACTIVE", balance: 8000 });
  m.tx.payment.findUnique.mockResolvedValue(null);
  m.tx.payment.count.mockResolvedValue(0);
  m.tx.order.updateMany.mockResolvedValue({ count: 1 });
  m.tx.storeWallet.updateMany.mockResolvedValue({ count: 1 });
  m.tx.storeWallet.findUniqueOrThrow.mockResolvedValue({ balance: 3000 });
  m.tx.payment.create.mockResolvedValue({ id: "p1" });
  m.tx.payment.updateMany.mockResolvedValue({ count: 0 });
});

describe("payOrderFromWallet", () => {
  it("pays: order PAID, wallet debited, payment + ledger line written, stock taken, vendor payout queued", async () => {
    const r = await payOrderFromWallet({ orderId: "ord1", userId: "u1" });
    expect(r).toEqual({ ok: true, alreadyPaid: false });
    expect(m.tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PAID", paymentProvider: "WALLET", paymentReference: "WALPAY-ord1" }) }));
    expect(m.tx.storeWallet.updateMany).toHaveBeenCalledWith({ where: { id: "w1", status: "ACTIVE", balance: { gte: 5000 } }, data: { balance: { decrement: 5000 } } });
    expect(m.tx.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ provider: "WALLET", purpose: "ORDER", status: "SUCCESSFUL", amount: 5000, orderId: "ord1", walletId: "w1" }) });
    expect(m.tx.walletTransaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "PAYMENT", amount: -5000, balanceAfter: 3000, orderId: "ord1" }) });
    expect(m.decrementStockForOrder).toHaveBeenCalledWith(m.tx, "ord1", { allowOversell: true });
    expect(m.postOrderSaleToLedger).toHaveBeenCalledWith("ord1");
    expect(m.settleAndPayout).toHaveBeenCalledWith("WALPAY-ord1");
    expect(m.notifyCustomer).toHaveBeenCalledWith("ord1");
  });

  it("closes any open card/transfer attempt for the order so it can't be paid twice", async () => {
    await payOrderFromWallet({ orderId: "ord1", userId: "u1" });
    expect(m.tx.payment.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ orderId: "ord1", status: "PENDING" }), data: { status: "FAILED" } });
  });

  it("refuses when the balance is short and charges nothing", async () => {
    m.tx.storeWallet.updateMany.mockResolvedValue({ count: 0 });
    const r = await payOrderFromWallet({ orderId: "ord1", userId: "u1" });
    expect(r).toMatchObject({ ok: false, code: "INSUFFICIENT_FUNDS" });
    expect(m.settleAndPayout).not.toHaveBeenCalled();
    expect(m.emitWebhookEvent).not.toHaveBeenCalled();
  });

  it("refuses a frozen or missing wallet", async () => {
    m.tx.storeWallet.findUnique.mockResolvedValue({ id: "w1", status: "SUSPENDED", balance: 99999 });
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toMatchObject({ ok: false, code: "WALLET_UNAVAILABLE" });
    m.tx.storeWallet.findUnique.mockResolvedValue(null);
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toMatchObject({ ok: false, code: "WALLET_UNAVAILABLE" });
  });

  it("refuses non-naira orders", async () => {
    m.prisma.order.findFirst.mockResolvedValue({ ...order, currency: "USD" });
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toMatchObject({ ok: false, code: "CURRENCY" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("only the buyer can pay (lookup is scoped to the buyer)", async () => {
    m.prisma.order.findFirst.mockResolvedValue(null);
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "someone-else" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(m.prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ord1", buyerId: "someone-else" } }));
  });

  it("is idempotent: an order already paid from the wallet reports success without charging again", async () => {
    m.prisma.order.findFirst.mockResolvedValue({ ...order, status: "PAID" });
    m.prisma.payment.findUnique.mockResolvedValue({ status: "SUCCESSFUL" });
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toEqual({ ok: true, alreadyPaid: true });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not double-charge when a concurrent request already settled the wallet payment", async () => {
    m.tx.payment.findUnique.mockResolvedValue({ status: "SUCCESSFUL" });
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toEqual({ ok: true, alreadyPaid: true });
    expect(m.tx.storeWallet.updateMany).not.toHaveBeenCalled();
    expect(m.settleAndPayout).not.toHaveBeenCalled();
  });

  it("refuses an order already paid by another method or lost the race", async () => {
    m.tx.payment.count.mockResolvedValue(1);
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toMatchObject({ ok: false, code: "NOT_PAYABLE" });
    m.tx.payment.count.mockResolvedValue(0);
    m.tx.order.updateMany.mockResolvedValue({ count: 0 });
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toMatchObject({ ok: false, code: "NOT_PAYABLE" });
  });

  it("refuses when a bank-transfer proof is already waiting for the vendor", async () => {
    m.prisma.order.findFirst.mockResolvedValue({ ...order, paymentProvider: "CASH", paymentProofUrl: "https://x/y.png" });
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toMatchObject({ ok: false, code: "NOT_PAYABLE" });
  });

  it("debits only what is still owed after a quote deposit", async () => {
    m.payable.mockResolvedValue(3000);
    await payOrderFromWallet({ orderId: "ord1", userId: "u1" });
    expect(m.tx.storeWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { balance: { decrement: 3000 } } }));
  });

  it("a failure after payment (e.g. ledger) does not turn a paid order into an error", async () => {
    m.postOrderSaleToLedger.mockRejectedValue(new Error("ledger down"));
    expect(await payOrderFromWallet({ orderId: "ord1", userId: "u1" })).toEqual({ ok: true, alreadyPaid: false });
  });
});
