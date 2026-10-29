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

export type AttachResult = { ok: true; refereePoints: number } | { ok: false; error: string };

/**
 * Collapses cosmetic email variants (gmail dots, +tags) so a "second account"
 * made from the same mailbox is recognised as the same person.
 */
export function canonicalEmail(email: string): string {
  const [rawLocal = "", domain = ""] = email.trim().toLowerCase().split("@");
  const local = rawLocal.split("+")[0];
  const isGoogle = domain === "gmail.com" || domain === "googlemail.com";
  return `${isGoogle ? local.replace(/\./g, "") : local}@${isGoogle ? "gmail.com" : domain}`;
}

export type ReferralCodePreview =
  | { status: "valid"; refereePoints: number }
  | { status: "paused" | "invalid" | "none" };

/** Read-only check used by the register page to tell the friend what the code is worth. */
export async function previewReferralCode(storeId: string, rawCode: string | undefined): Promise<ReferralCodePreview> {
  const code = normalizeReferralCode(rawCode ?? "");
  if (!code) return { status: "none" };
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { referralEnabled: true, referralRefereePoints: true } });
  if (!store?.referralEnabled) return { status: "paused" };
  const owner = await prisma.referralCode.findUnique({ where: { storeId_code: { storeId, code } }, select: { id: true } });
  if (!owner) return { status: "invalid" };
  return { status: "valid", refereePoints: store.referralRefereePoints };
}

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

  const store = await prisma.store.findUnique({ where: { id: params.storeId }, select: { referralEnabled: true, referralReferrerPoints: true, referralRefereePoints: true } });
  if (!store?.referralEnabled) return { ok: false, error: "This store isn't running a referral program right now." };

  const owner = await prisma.referralCode.findUnique({ where: { storeId_code: { storeId: params.storeId, code } } });
  if (!owner) return { ok: false, error: "That referral code isn't valid." };
  if (owner.userId === params.refereeId) return { ok: false, error: "You can't use your own referral code." };

  // A second account on the same mailbox (gmail dots / +tags) is still self-referral.
  const [referrer, referee] = await Promise.all([
    prisma.user.findUnique({ where: { id: owner.userId }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: params.refereeId }, select: { email: true } }),
  ]);
  if (referrer?.email && referee?.email && canonicalEmail(referrer.email) === canonicalEmail(referee.email)) {
    return { ok: false, error: "You can't use your own referral code." };
  }

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
      data: {
        storeId: params.storeId,
        codeId: owner.id,
        referrerId: owner.userId,
        refereeId: params.refereeId,
        // Lock in what the friend was shown at signup; payout honours this.
        promisedReferrerPoints: Math.max(0, store.referralReferrerPoints),
        promisedRefereePoints: Math.max(0, store.referralRefereePoints),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A referral code has already been applied to your account." };
    }
    throw err;
  }
  return { ok: true, refereePoints: Math.max(0, store.referralRefereePoints) };
}
