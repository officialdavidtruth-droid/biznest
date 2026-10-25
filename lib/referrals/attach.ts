import "server-only";

import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Referral codes and attribution. No auth of its own: callers (the
 * signup action, and the account "enter a code" action) establish who the
 * referred customer is before calling attachReferral.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeReferralCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateReferralCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** One code per customer per store, created on first need. */
export async function getOrCreateReferralCode(storeId: string, userId: string) {
  const existing = await prisma.referralCode.findUnique({ where: { storeId_userId: { storeId, userId } } });
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.referralCode.create({ data: { storeId, userId, code: generateReferralCode() } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Either a code collision (retry) or this user's code was just created
        // by a concurrent request (return it).
        const raced = await prisma.referralCode.findUnique({ where: { storeId_userId: { storeId, userId } } });
        if (raced) return raced;
        continue;
      }
      throw err;
    }
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

export type AttachResult = { ok: true } | { ok: false; error: string };

/**
 * Links `refereeId` to whoever owns `code` at this store. Rules:
 *  - the store must have the program switched on
 *  - you can't refer yourself
 *  - one referrer per customer per store (DB-unique), and it can't be swapped later
 *  - only customers who haven't yet placed a real order can be referred
 */
export async function attachReferral(params: { storeId: string; refereeId: string; code: string }): Promise<AttachResult> {
  const code = normalizeReferralCode(params.code);
  if (!code) return { ok: false, error: "Enter a referral code." };

  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { referralEnabled: true } });
  if (!store?.referralEnabled) return { ok: false, error: "This store isn't running a referral program right now." };

  const owner = await prisma.referralCode.findUnique({ where: { storeId_code: { storeId: params.storeId, code } } });
  if (!owner) return { ok: false, error: "That referral code isn't valid." };
  if (owner.userId === params.refereeId) return { ok: false, error: "You can't use your own referral code." };

  const already = await prisma.referral.findUnique({
    where: { storeId_refereeId: { storeId: params.storeId, refereeId: params.refereeId } },
    select: { id: true },
  });
  if (already) return { ok: false, error: "A referral code has already been applied to your account." };

  const priorOrders = await prisma.order.count({
    where: { storeId: params.storeId, buyerId: params.refereeId, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
  });
  if (priorOrders > 0) return { ok: false, error: "Referral codes are only for customers who haven't ordered yet." };

  try {
    await prisma.referral.create({
      data: { storeId: params.storeId, codeId: owner.id, referrerId: owner.userId, refereeId: params.refereeId },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A referral code has already been applied to your account." };
    }
    throw err;
  }
  return { ok: true };
}
