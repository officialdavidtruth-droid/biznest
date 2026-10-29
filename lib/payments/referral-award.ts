import "server-only";

import { prisma } from "@/lib/prisma";
import { logError, errorMeta } from "@/lib/observability/log";

/**
 * Referral rewards. System-triggered (no auth of its own): callers are the
 * order-completion paths (via awardStoreLoyaltyPointsForOrder), the refund
 * paths (reverseReferralForOrder), and merchant actions that have already
 * checked permission (reconcileReferral, cancelPendingReferral).
 *
 * Rewards are store loyalty points, which customers can cash out as coupons --
 * so a payout is real money for the merchant and is guarded accordingly:
 *  - only a COMPLETED order can qualify, and it must reach the store's
 *    minimum order value
 *  - the referred friend's email must be verified
 *  - a referrer can earn at most `referralMaxRewardsPerReferrer` rewards
 *  - PENDING referrals can expire
 *
 * Exactly-once: the Referral row is flipped PENDING -> REWARDED with a
 * status-guarded updateMany inside the same transaction that credits the
 * points. A replay finds count 0 and does nothing; qualifyingOrderId is also
 * unique, so one order can never reward two referrals.
 */

export type RewardOutcome = "PAID" | "SKIPPED" | "HELD";

class RewardHeld extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

export const HOLD_NOTES = {
  paused: "Program is paused — paid when the merchant switches it back on.",
  unverified: "Waiting for the new customer to verify their email.",
  capReached: "Referrer has reached the reward limit for this store.",
} as const;

async function setPendingNote(referralId: string, note: string) {
  await prisma.referral.updateMany({ where: { id: referralId, status: "PENDING", NOT: { note } }, data: { note } });
}

export async function awardReferralRewardForOrder(orderId: string): Promise<RewardOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, storeId: true, buyerId: true, status: true, subtotal: true },
  });
  if (!order) return "SKIPPED";
  // Don't trust callers: only an order that is actually COMPLETED can qualify.
  if (order.status !== "COMPLETED") return "SKIPPED";

  const referral = await prisma.referral.findUnique({
    where: { storeId_refereeId: { storeId: order.storeId, refereeId: order.buyerId } },
    include: {
      store: {
        select: {
          referralEnabled: true,
          referralReferrerPoints: true,
          referralRefereePoints: true,
          referralMinOrderAmount: true,
          referralMaxRewardsPerReferrer: true,
          referralExpiryDays: true,
        },
      },
      referee: { select: { emailVerified: true } },
    },
  });
  if (!referral || referral.status !== "PENDING") return "SKIPPED";
  const settings = referral.store;

  if (!settings.referralEnabled) {
    await setPendingNote(referral.id, HOLD_NOTES.paused);
    return "HELD";
  }

  if (settings.referralExpiryDays > 0) {
    const expiresAt = referral.createdAt.getTime() + settings.referralExpiryDays * 86_400_000;
    if (Date.now() > expiresAt) {
      await prisma.referral.updateMany({
        where: { id: referral.id, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date(), note: "Expired before a qualifying order." },
      });
      return "SKIPPED";
    }
  }

  // Minimum qualifying order value (0 = any order).
  const minOrder = Number(settings.referralMinOrderAmount ?? 0);
  if (Number(order.subtotal) < minOrder) return "SKIPPED";

  // "First order" = no earlier completed order at this store that would itself have qualified.
  const earlier = await prisma.order.count({
    where: {
      storeId: order.storeId,
      buyerId: order.buyerId,
      status: "COMPLETED",
      id: { not: order.id },
      ...(minOrder > 0 ? { subtotal: { gte: minOrder } } : {}),
    },
  });
  if (earlier > 0) return "SKIPPED";

  if (!referral.referee.emailVerified) {
    await setPendingNote(referral.id, HOLD_NOTES.unverified);
    return "HELD";
  }

  // Honour what the friend was promised at signup; fall back to current rates for old rows.
  const referrerPoints = Math.max(0, referral.promisedReferrerPoints ?? settings.referralReferrerPoints);
  const refereePoints = Math.max(0, referral.promisedRefereePoints ?? settings.referralRefereePoints);
  const cap = settings.referralMaxRewardsPerReferrer;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id: referral.id, status: "PENDING" },
        data: { status: "REWARDED", qualifyingOrderId: order.id, referrerPoints, refereePoints, rewardedAt: new Date(), note: null },
      });
      if (claimed.count !== 1) throw new RewardHeld("__lost_claim__");

      // Re-checked inside the transaction so concurrent completions can't both slip under the cap.
      if (cap > 0) {
        const rewarded = await tx.referral.count({ where: { storeId: order.storeId, referrerId: referral.referrerId, status: "REWARDED" } });
        if (rewarded > cap) throw new RewardHeld(HOLD_NOTES.capReached);
      }

      const credit = async (userId: string, points: number, note: string) => {
        if (points <= 0) return;
        const account = await tx.storeLoyaltyAccount.upsert({
          where: { storeId_userId: { storeId: order.storeId, userId } },
          create: { storeId: order.storeId, userId, pointsBalance: 0 },
          update: {},
        });
        await tx.storeLoyaltyEntry.create({
          data: { loyaltyAccountId: account.id, orderId: order.id, referralId: referral.id, type: "ADJUSTMENT", points, note },
        });
        await tx.storeLoyaltyAccount.update({ where: { id: account.id }, data: { pointsBalance: { increment: points } } });
      };

      await credit(referral.referrerId, referrerPoints, "Referral reward — your friend placed their first order");
      await credit(referral.refereeId, refereePoints, "Welcome reward for joining through a referral");
    });
  } catch (err) {
    if (err instanceof RewardHeld) {
      if (err.reason === "__lost_claim__") return "SKIPPED"; // replay / concurrent completion
      await setPendingNote(referral.id, err.reason);
      return "HELD";
    }
    throw err;
  }
  return "PAID";
}

/**
 * Merchant "pay now / retry". Finds the friend's first qualifying completed
 * order and runs the normal payout checks on it. Safe to repeat.
 */
export async function reconcileReferral(referralId: string, storeId: string): Promise<RewardOutcome | "NO_QUALIFYING_ORDER"> {
  const referral = await prisma.referral.findFirst({
    where: { id: referralId, storeId, status: "PENDING" },
    select: { refereeId: true, store: { select: { referralMinOrderAmount: true } } },
  });
  if (!referral) return "SKIPPED";
  const minOrder = Number(referral.store.referralMinOrderAmount ?? 0);
  const order = await prisma.order.findFirst({
    where: { storeId, buyerId: referral.refereeId, status: "COMPLETED", ...(minOrder > 0 ? { subtotal: { gte: minOrder } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!order) return "NO_QUALIFYING_ORDER";
  return awardReferralRewardForOrder(order.id);
}

/** Cancels a referral that hasn't been paid. Returns false if it was no longer PENDING. */
export async function cancelPendingReferral(referralId: string, storeId: string, reason: string): Promise<boolean> {
  const res = await prisma.referral.updateMany({
    where: { id: referralId, storeId, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date(), note: reason },
  });
  return res.count === 1;
}

/**
 * Called when an order is refunded. If that order paid out a referral reward,
 * claws the points back (up to what's still in each balance -- points already
 * cashed out as coupons can't be recovered here) and marks the referral REVERSED.
 */
export async function reverseReferralForOrder(orderId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { qualifyingOrderId: orderId },
    select: { id: true, storeId: true, referrerId: true, refereeId: true, referrerPoints: true, refereePoints: true, status: true },
  });
  if (!referral || referral.status !== "REWARDED") return;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.referral.updateMany({
      where: { id: referral.id, status: "REWARDED" },
      data: { status: "REVERSED", reversedAt: new Date() },
    });
    if (claimed.count !== 1) return;

    let recovered = 0;
    const debit = async (userId: string, points: number, note: string) => {
      if (points <= 0) return;
      const account = await tx.storeLoyaltyAccount.findUnique({
        where: { storeId_userId: { storeId: referral.storeId, userId } },
        select: { id: true, pointsBalance: true },
      });
      if (!account) return;
      const take = Math.min(points, Math.max(0, account.pointsBalance));
      if (take <= 0) return;
      await tx.storeLoyaltyEntry.create({
        data: { loyaltyAccountId: account.id, orderId, referralId: referral.id, type: "ADJUSTMENT", points: -take, note },
      });
      await tx.storeLoyaltyAccount.update({ where: { id: account.id }, data: { pointsBalance: { decrement: take } } });
      recovered += take;
    };

    await debit(referral.referrerId, referral.referrerPoints, "Referral reward reversed — the qualifying order was refunded");
    await debit(referral.refereeId, referral.refereePoints, "Welcome reward reversed — the qualifying order was refunded");

    const paid = referral.referrerPoints + referral.refereePoints;
    await tx.referral.update({
      where: { id: referral.id },
      data: { note: `Order refunded. Recovered ${recovered} of ${paid} points${recovered < paid ? " (the rest was already spent)" : ""}.` },
    });
  });
}

/** Refund-path wrapper: a failed clawback must never undo or block the refund itself. */
export async function reverseReferralForOrderSafely(orderId: string): Promise<void> {
  try {
    await reverseReferralForOrder(orderId);
  } catch (err) {
    await logError("JOBS", "Referral reversal failed after refund", errorMeta(err, { orderId }));
  }
}

/** After a customer verifies their email, release any reward that was waiting on that. */
export async function reconcileReferralsForReferee(userId: string): Promise<void> {
  try {
    const pending = await prisma.referral.findMany({ where: { refereeId: userId, status: "PENDING" }, select: { id: true, storeId: true } });
    for (const r of pending) await reconcileReferral(r.id, r.storeId);
  } catch (err) {
    await logError("JOBS", "Referral payout after email verification failed", errorMeta(err, { userId }));
  }
}
