import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Pays the referral reward when a referred customer's FIRST order completes.
 * System-triggered (no auth of its own) and called from
 * awardStoreLoyaltyPointsForOrder, which both order-completion paths already
 * use. Rewards are store loyalty points -- no money moves.
 *
 * Exactly-once: the Referral row is flipped PENDING -> REWARDED with a
 * status-guarded updateMany inside the same transaction that credits the
 * points. A replay finds count 0 and does nothing; qualifyingOrderId is also
 * unique, so one order can never reward two referrals.
 */
export async function awardReferralRewardForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, storeId: true, buyerId: true, status: true },
  });
  if (!order) return;

  const referral = await prisma.referral.findUnique({
    where: { storeId_refereeId: { storeId: order.storeId, refereeId: order.buyerId } },
    include: { store: { select: { referralEnabled: true, referralReferrerPoints: true, referralRefereePoints: true } } },
  });
  if (!referral || referral.status !== "PENDING") return;
  if (!referral.store.referralEnabled) return;

  // "First order" = no other completed order by this customer at this store.
  const earlier = await prisma.order.count({
    where: { storeId: order.storeId, buyerId: order.buyerId, status: "COMPLETED", id: { not: order.id } },
  });
  if (earlier > 0) return;

  const referrerPoints = Math.max(0, referral.store.referralReferrerPoints);
  const refereePoints = Math.max(0, referral.store.referralRefereePoints);

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.referral.updateMany({
      where: { id: referral.id, status: "PENDING" },
      data: { status: "REWARDED", qualifyingOrderId: order.id, referrerPoints, refereePoints, rewardedAt: new Date() },
    });
    if (claimed.count !== 1) return;

    const credit = async (userId: string, points: number, note: string) => {
      if (points <= 0) return;
      const account = await tx.storeLoyaltyAccount.upsert({
        where: { storeId_userId: { storeId: order.storeId, userId } },
        create: { storeId: order.storeId, userId, pointsBalance: 0 },
        update: {},
      });
      await tx.storeLoyaltyEntry.create({ data: { loyaltyAccountId: account.id, type: "ADJUSTMENT", points, note } });
      await tx.storeLoyaltyAccount.update({ where: { id: account.id }, data: { pointsBalance: { increment: points } } });
    };

    await credit(referral.referrerId, referrerPoints, "Referral reward — your friend placed their first order");
    await credit(referral.refereeId, refereePoints, "Welcome reward for joining through a referral");
  });
}
