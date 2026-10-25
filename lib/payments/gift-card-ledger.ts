import "server-only";

import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/utils/pricing";
import { formatMoney } from "@/lib/utils/format-money";

/**
 * Gift-card ledger. Every balance change goes through here so GiftCard.balance
 * and GiftCardTransaction always move together, in one DB transaction.
 *
 * Lives outside "use server" files on purpose: these take caller-supplied
 * amounts and do no auth of their own, so they must never be callable as
 * public endpoints. Import them only from server actions that have already
 * checked who is asking (see lib/actions/gift-card.ts).
 */

// No 0/O/1/I/L so codes survive being read out loud or copied from a screenshot.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateGiftCardCode(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `GC-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Accepts "gc-abcd efgh-jkmn", "GCABCDEFGHJKMN", etc. and returns the canonical form. */
export function normalizeGiftCardCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.startsWith("GC") && cleaned.length === 14) {
    return `GC-${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}-${cleaned.slice(10, 14)}`;
  }
  return cleaned;
}

type Tx = Prisma.TransactionClient;

export type IssueGiftCardInput = {
  storeId: string;
  amount: number;
  currency?: string;
  expiresAt?: Date | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  message?: string | null;
  purchaserId?: string | null;
  issuedById?: string | null;
  note?: string | null;
};

export async function issueGiftCard(input: IssueGiftCardInput) {
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new Error("INVALID_AMOUNT");

  // A 60-bit random code makes collisions vanishingly rare, but the unique
  // index is the real guarantee -- retry on the (theoretical) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const card = await tx.giftCard.create({
          data: {
            storeId: input.storeId,
            code: generateGiftCardCode(),
            initialAmount: amount,
            balance: amount,
            currency: input.currency ?? "NGN",
            expiresAt: input.expiresAt ?? null,
            recipientName: input.recipientName ?? null,
            recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
            message: input.message ?? null,
            purchaserId: input.purchaserId ?? null,
            issuedById: input.issuedById ?? null,
          },
        });
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: card.id,
            type: "ISSUE",
            amount,
            balanceAfter: amount,
            note: input.note ?? "Issued",
            createdById: input.issuedById ?? null,
          },
        });
        return card;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("CODE_GENERATION_FAILED");
}

export type RedeemResult =
  | { ok: true; cardId: string; redeemed: number; balanceAfter: number }
  | { ok: false; error: string };

/**
 * Takes `amount` off a card. The decrement is a single conditional UPDATE
 * (balance >= amount, ACTIVE), so two simultaneous redemptions can never
 * spend the same money twice -- the loser matches zero rows and is refused.
 */
export async function redeemGiftCard(params: {
  storeId: string;
  code: string;
  amount: number;
  orderId?: string | null;
  note?: string | null;
  createdById?: string | null;
  currency?: string;
}): Promise<RedeemResult> {
  const amount = roundMoney(params.amount);
  if (!(amount > 0)) return { ok: false, error: "Enter an amount greater than zero." };
  const code = normalizeGiftCardCode(params.code);

  return prisma.$transaction(async (tx: Tx) => {
    const card = await tx.giftCard.findUnique({ where: { storeId_code: { storeId: params.storeId, code } } });
    // Same message for "no such card" and "wrong store" so codes can't be probed.
    if (!card) return { ok: false as const, error: "That gift card isn't valid." };
    if (card.status !== "ACTIVE") return { ok: false as const, error: "This gift card is disabled." };
    if (card.expiresAt && card.expiresAt < new Date()) return { ok: false as const, error: "This gift card has expired." };
    if (params.currency && card.currency !== params.currency) {
      return { ok: false as const, error: `This gift card is in ${card.currency}.` };
    }

    const updated = await tx.giftCard.updateMany({
      where: { id: card.id, status: "ACTIVE", balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (updated.count !== 1) {
      return { ok: false as const, error: `Not enough balance — ${formatMoney(Number(card.balance))} remaining.` };
    }

    const fresh = await tx.giftCard.findUniqueOrThrow({ where: { id: card.id }, select: { balance: true } });
    const balanceAfter = Number(fresh.balance);
    await tx.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        type: "REDEEM",
        amount: -amount,
        balanceAfter,
        orderId: params.orderId ?? null,
        note: params.note ?? null,
        createdById: params.createdById ?? null,
      },
    });
    return { ok: true as const, cardId: card.id, redeemed: amount, balanceAfter };
  });
}

/**
 * Puts back whatever an order redeemed (cancelled/refunded order). Idempotent:
 * a card that already has a REFUND row for this order is skipped, so a retried
 * cancellation can't credit twice.
 */
export async function refundGiftCardRedemptionsForOrder(orderId: string): Promise<number> {
  return prisma.$transaction(async (tx: Tx) => {
    const redemptions = await tx.giftCardTransaction.findMany({ where: { orderId, type: "REDEEM" } });
    let refunded = 0;
    for (const r of redemptions) {
      const already = await tx.giftCardTransaction.findFirst({ where: { orderId, giftCardId: r.giftCardId, type: "REFUND" } });
      if (already) continue;
      const credit = Math.abs(Number(r.amount));
      await tx.giftCard.update({ where: { id: r.giftCardId }, data: { balance: { increment: credit } } });
      const fresh = await tx.giftCard.findUniqueOrThrow({ where: { id: r.giftCardId }, select: { balance: true } });
      await tx.giftCardTransaction.create({
        data: { giftCardId: r.giftCardId, type: "REFUND", amount: credit, balanceAfter: Number(fresh.balance), orderId, note: "Order cancelled/refunded" },
      });
      refunded++;
    }
    return refunded;
  });
}
