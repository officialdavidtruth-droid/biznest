import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    giftCard: { findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    giftCardTransaction: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  };
  return { tx, transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
});

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));

import {
  generateGiftCardCode,
  normalizeGiftCardCode,
  redeemGiftCard,
  refundGiftCardRedemptionsForOrder,
} from "@/lib/payments/gift-card-ledger";

const card = (over: Record<string, unknown> = {}) => ({
  id: "c1", storeId: "s1", code: "GC-ABCD-EFGH-JKMN", balance: 5000, currency: "NGN", status: "ACTIVE", expiresAt: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
});

describe("code format", () => {
  it("generates GC-XXXX-XXXX-XXXX without look-alike characters", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const code = generateGiftCardCode();
      expect(code).toMatch(/^GC-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      seen.add(code);
    }
    expect(seen.size).toBe(300);
  });

  it("normalizes spacing, case and missing dashes to the canonical form", () => {
    const canonical = "GC-ABCD-EFGH-JKMN";
    expect(normalizeGiftCardCode("gc-abcd-efgh-jkmn")).toBe(canonical);
    expect(normalizeGiftCardCode("  gc abcd efgh jkmn ")).toBe(canonical);
    expect(normalizeGiftCardCode("GCABCDEFGHJKMN")).toBe(canonical);
  });
});

describe("redeemGiftCard", () => {
  it("deducts and writes a negative REDEEM ledger row", async () => {
    m.tx.giftCard.findUnique.mockResolvedValue(card());
    m.tx.giftCard.updateMany.mockResolvedValue({ count: 1 });
    m.tx.giftCard.findUniqueOrThrow.mockResolvedValue({ balance: 3500 });

    const res = await redeemGiftCard({ storeId: "s1", code: "gc-abcd-efgh-jkmn", amount: 1500, orderId: "o1" });

    expect(res).toEqual({ ok: true, cardId: "c1", redeemed: 1500, balanceAfter: 3500 });
    expect(m.tx.giftCard.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", status: "ACTIVE", balance: { gte: 1500 } },
      data: { balance: { decrement: 1500 } },
    });
    expect(m.tx.giftCardTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ giftCardId: "c1", type: "REDEEM", amount: -1500, balanceAfter: 3500, orderId: "o1" }),
    });
  });

  it("refuses when the conditional update matches nothing (insufficient or raced) and writes no ledger row", async () => {
    m.tx.giftCard.findUnique.mockResolvedValue(card({ balance: 1000 }));
    m.tx.giftCard.updateMany.mockResolvedValue({ count: 0 });

    const res = await redeemGiftCard({ storeId: "s1", code: "GC-ABCD-EFGH-JKMN", amount: 2000 });

    expect(res.ok).toBe(false);
    expect(m.tx.giftCardTransaction.create).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown code", null],
    ["disabled card", card({ status: "DISABLED" })],
    ["expired card", card({ expiresAt: new Date(Date.now() - 1000) })],
    ["wrong currency", card({ currency: "USD" })],
  ])("refuses %s without touching the balance", async (_label, found) => {
    m.tx.giftCard.findUnique.mockResolvedValue(found);
    const res = await redeemGiftCard({ storeId: "s1", code: "GC-ABCD-EFGH-JKMN", amount: 100, currency: "NGN" });
    expect(res.ok).toBe(false);
    expect(m.tx.giftCard.updateMany).not.toHaveBeenCalled();
  });

  it("rejects zero/negative amounts before any database work", async () => {
    for (const amount of [0, -5, NaN]) {
      const res = await redeemGiftCard({ storeId: "s1", code: "GC-ABCD-EFGH-JKMN", amount });
      expect(res.ok).toBe(false);
    }
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the store so another store's code can't be spent", async () => {
    m.tx.giftCard.findUnique.mockResolvedValue(null);
    await redeemGiftCard({ storeId: "s2", code: "GC-ABCD-EFGH-JKMN", amount: 100 });
    expect(m.tx.giftCard.findUnique).toHaveBeenCalledWith({ where: { storeId_code: { storeId: "s2", code: "GC-ABCD-EFGH-JKMN" } } });
  });
});

describe("refundGiftCardRedemptionsForOrder", () => {
  it("credits a redemption back once", async () => {
    m.tx.giftCardTransaction.findMany.mockResolvedValue([{ giftCardId: "c1", amount: -1500 }]);
    m.tx.giftCardTransaction.findFirst.mockResolvedValue(null);
    m.tx.giftCard.findUniqueOrThrow.mockResolvedValue({ balance: 5000 });

    expect(await refundGiftCardRedemptionsForOrder("o1")).toBe(1);
    expect(m.tx.giftCard.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { balance: { increment: 1500 } } });
    expect(m.tx.giftCardTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "REFUND", amount: 1500, orderId: "o1" }),
    });
  });

  it("is a no-op when this order was already refunded", async () => {
    m.tx.giftCardTransaction.findMany.mockResolvedValue([{ giftCardId: "c1", amount: -1500 }]);
    m.tx.giftCardTransaction.findFirst.mockResolvedValue({ id: "t9" });

    expect(await refundGiftCardRedemptionsForOrder("o1")).toBe(0);
    expect(m.tx.giftCard.update).not.toHaveBeenCalled();
  });
});
