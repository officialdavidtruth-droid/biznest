import { prisma } from "@/lib/prisma";

// --- BizNest Trust Score ----------------------------------------------------
// A single 0-100 number that goes beyond a star rating: it blends how
// verified, active, reliable, and responsive a business actually is. Every
// factor is computed live from real rows (orders, reviews, disputes,
// messages) rather than stored/cached, so it's always up to date and there's
// no invalidation logic to keep in sync with every place an order or review
// can change. Store counts are small enough per business that this is cheap.
//
// Weights sum to 100. Each factor is independently capped so one bad number
// (e.g. a business with zero orders yet) can't zero out the whole score --
// new/unproven businesses land in a fair "not enough history" middle range
// rather than being punished the same as a business with a bad track record.

export type TrustScoreFactor = {
  key: string;
  label: string;
  points: number; // points earned
  max: number; // points available
  detail: string; // human-readable "why"
};

export type TrustScoreBreakdown = {
  score: number; // 0-100, rounded
  factors: TrustScoreFactor[];
};

// --- Customer-facing checklist ----------------------------------------------
// The dashboard breakdown above is seller-facing (factor points/max, for a
// business to see what to improve). This is the buyer-facing translation:
// short, plain-language, pass/fail claims for a storefront trust panel.
// Every item here is backed by a real column we actually track -- there is
// no "phone verified" item because Business has no phoneVerifiedAt field
// yet (see note on getTrustScoreChecklist). Don't add a checklist line
// unless there's a real DB fact behind it; a false "verified" claim is a
// liability, not a differentiator.

export type TrustScoreChecklistItem = {
  key: string;
  label: string;
  met: boolean;
};

export type TrustScoreChecklist = {
  score: number;
  items: TrustScoreChecklistItem[];
};

export async function getTrustScoreChecklist(businessId: string): Promise<TrustScoreChecklist | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { store: true },
  });
  if (!business) return null;

  const storeId = business.store?.id;
  const breakdown = await getTrustScoreBreakdown(businessId);
  if (!breakdown) return null;

  const completedFactor = breakdown.factors.find((f) => f.key === "completedTransactions");
  const disputesFactor = breakdown.factors.find((f) => f.key === "complaints");
  const completedOrders = completedFactor
    ? Number(completedFactor.detail.match(/^\d[\d,]*/)?.[0].replace(/,/g, "") ?? 0)
    : 0;

  const months = (Date.now() - business.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);

  const items: TrustScoreChecklistItem[] = [
    {
      key: "identity",
      label: business.registrationType === "UNREGISTERED" ? "Identity verified" : "Business verified",
      met: business.verificationStatus === "APPROVED",
    },
    {
      key: "payment",
      // Backed by Store.payoutVerifiedAt, which is only set once Paystack
      // confirms real KYC verification on the subaccount (not merely
      // "connected" -- see refreshPayoutVerification in lib/actions/store.ts).
      // Was previously stamped at connection time, which meant this checklist
      // item claimed "verified" for stores that had only linked a bank
      // account and hadn't actually passed Paystack's review yet.
      met: Boolean(business.store?.payoutVerifiedAt),
      label: "Payment verified",
    },
    {
      key: "orders",
      label: completedOrders > 0 ? `${completedOrders.toLocaleString()} successful order${completedOrders === 1 ? "" : "s"}` : "No completed orders yet",
      met: completedOrders > 0,
    },
    {
      key: "rating",
      label: business.avgRating != null && business.reviewCount > 0
        ? `${business.avgRating.toFixed(1)}/5 customer rating`
        : "No customer ratings yet",
      met: business.avgRating != null && business.avgRating >= 4 && business.reviewCount > 0,
    },
    {
      key: "disputes",
      label: "Low dispute rate",
      met: (disputesFactor?.points ?? 0) >= (disputesFactor?.max ?? 10) * 0.7,
    },
    {
      key: "active",
      label: months < 1 ? "Newly joined BizNest" : `Active for ${Math.floor(months)} month${Math.floor(months) === 1 ? "" : "s"}`,
      met: months >= 1,
    },
  ];

  return { score: breakdown.score, items };
}

const WEIGHTS = {
  verification: 15,
  completedTransactions: 20,
  reviews: 15,
  responseTime: 10,
  cancellationRate: 10,
  refundRate: 10,
  complaints: 10,
  accountAge: 10,
} as const;

export async function getTrustScoreBreakdown(businessId: string): Promise<TrustScoreBreakdown | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { store: true },
  });
  if (!business) return null;

  const storeId = business.store?.id;

  const [orderCounts, disputeCounts, responseTimeMs] = await Promise.all([
    storeId
      ? prisma.order.groupBy({
          by: ["status"],
          where: { storeId },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    storeId
      ? prisma.dispute.groupBy({
          by: ["status"],
          where: { order: { storeId } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    storeId ? computeAvgFirstResponseMs(storeId) : Promise.resolve(null),
  ]);

  const totalOrders = orderCounts.reduce((sum, o) => sum + o._count._all, 0);
  const completedOrders = orderCounts.find((o) => o.status === "COMPLETED")?._count._all ?? 0;
  const cancelledOrders = orderCounts.find((o) => o.status === "CANCELLED")?._count._all ?? 0;
  const refundedOrders = orderCounts.find((o) => o.status === "REFUNDED")?._count._all ?? 0;
  const totalDisputes = disputeCounts.reduce((sum, d) => sum + d._count._all, 0);
  const buyerFaultDisputes = disputeCounts.find((d) => d.status === "RESOLVED_BUYER")?._count._all ?? 0;

  const factors: TrustScoreFactor[] = [
    verificationFactor(business.verificationStatus, business.verificationBadge),
    completedTransactionsFactor(completedOrders),
    reviewsFactor(business.avgRating, business.reviewCount),
    responseTimeFactor(responseTimeMs),
    cancellationRateFactor(cancelledOrders, totalOrders),
    refundRateFactor(refundedOrders, totalOrders),
    complaintsFactor(buyerFaultDisputes, totalDisputes, totalOrders),
    accountAgeFactor(business.createdAt),
  ];

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.points, 0))));

  return { score, factors };
}

async function computeAvgFirstResponseMs(storeId: string): Promise<number | null> {
  // "Response time" = how long it takes the seller to send their first reply
  // after a buyer's first message, averaged across a store's recent order
  // conversations. Capped to the last 25 conversations so this stays cheap.
  const conversations = await prisma.conversation.findMany({
    where: { order: { storeId } },
    include: {
      order: { select: { buyerId: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { senderId: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const gaps: number[] = [];
  for (const c of conversations) {
    const buyerId = c.order?.buyerId;
    if (!buyerId) continue;
    const firstBuyerMsg = c.messages.find((m) => m.senderId === buyerId);
    if (!firstBuyerMsg) continue;
    const firstSellerReply = c.messages.find(
      (m) => m.senderId !== buyerId && m.createdAt > firstBuyerMsg.createdAt
    );
    if (!firstSellerReply) continue;
    gaps.push(firstSellerReply.createdAt.getTime() - firstBuyerMsg.createdAt.getTime());
  }

  if (gaps.length === 0) return null;
  return gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
}

function verificationFactor(status: string, badge: boolean): TrustScoreFactor {
  const max = WEIGHTS.verification;
  if (status === "APPROVED" && badge) {
    return { key: "verification", label: "Verification", points: max, max, detail: "Verified business with trust badge" };
  }
  if (status === "APPROVED") {
    return { key: "verification", label: "Verification", points: max * 0.8, max, detail: "Verified business" };
  }
  if (status === "PENDING") {
    return { key: "verification", label: "Verification", points: max * 0.3, max, detail: "Verification pending review" };
  }
  return { key: "verification", label: "Verification", points: 0, max, detail: status === "SUSPENDED" ? "Verification suspended" : "Not verified" };
}

function completedTransactionsFactor(completed: number): TrustScoreFactor {
  const max = WEIGHTS.completedTransactions;
  // Diminishing-returns curve, full marks around 50+ completed orders — a
  // brand-new store isn't punished, it just hasn't earned this bucket yet.
  const ratio = Math.min(1, Math.log10(completed + 1) / Math.log10(51));
  const points = ratio * max;
  return {
    key: "completedTransactions",
    label: "Completed transactions",
    points,
    max,
    detail: completed === 0 ? "No completed orders yet" : `${completed.toLocaleString()} completed order${completed === 1 ? "" : "s"}`,
  };
}

function reviewsFactor(avgRating: number | null, reviewCount: number): TrustScoreFactor {
  const max = WEIGHTS.reviews;
  if (avgRating == null || reviewCount === 0) {
    return { key: "reviews", label: "Reviews", points: max * 0.4, max, detail: "No reviews yet" };
  }
  // Rating scaled to the weight, with a volume factor so 1 five-star review
  // doesn't score identically to 50 five-star reviews.
  const volumeFactor = Math.min(1, Math.log10(reviewCount + 1) / Math.log10(21));
  const points = (avgRating / 5) * max * (0.6 + 0.4 * volumeFactor);
  return {
    key: "reviews",
    label: "Reviews",
    points,
    max,
    detail: `${avgRating.toFixed(1)}/5 average across ${reviewCount.toLocaleString()} review${reviewCount === 1 ? "" : "s"}`,
  };
}

function responseTimeFactor(avgMs: number | null): TrustScoreFactor {
  const max = WEIGHTS.responseTime;
  if (avgMs == null) {
    return { key: "responseTime", label: "Response time", points: max * 0.5, max, detail: "Not enough message history yet" };
  }
  const hours = avgMs / (1000 * 60 * 60);
  let points: number;
  let detail: string;
  if (hours <= 1) { points = max; detail = "Replies to buyers within an hour, on average"; }
  else if (hours <= 6) { points = max * 0.75; detail = "Replies to buyers within a few hours, on average"; }
  else if (hours <= 24) { points = max * 0.5; detail = "Replies to buyers within a day, on average"; }
  else { points = max * 0.2; detail = "Replies to buyers often take more than a day"; }
  return { key: "responseTime", label: "Response time", points, max, detail };
}

function cancellationRateFactor(cancelled: number, total: number): TrustScoreFactor {
  const max = WEIGHTS.cancellationRate;
  if (total === 0) return { key: "cancellationRate", label: "Cancellation rate", points: max * 0.7, max, detail: "No order history yet" };
  const rate = cancelled / total;
  const points = Math.max(0, 1 - rate * 3) * max; // 33%+ cancellation rate → 0 points
  return { key: "cancellationRate", label: "Cancellation rate", points, max, detail: `${(rate * 100).toFixed(1)}% of orders cancelled` };
}

function refundRateFactor(refunded: number, total: number): TrustScoreFactor {
  const max = WEIGHTS.refundRate;
  if (total === 0) return { key: "refundRate", label: "Refund rate", points: max * 0.7, max, detail: "No order history yet" };
  const rate = refunded / total;
  const points = Math.max(0, 1 - rate * 3) * max;
  return { key: "refundRate", label: "Refund rate", points, max, detail: `${(rate * 100).toFixed(1)}% of orders refunded` };
}

function complaintsFactor(buyerFaultDisputes: number, totalDisputes: number, totalOrders: number): TrustScoreFactor {
  const max = WEIGHTS.complaints;
  if (totalOrders === 0) return { key: "complaints", label: "Customer complaints", points: max * 0.7, max, detail: "No order history yet" };
  const rate = buyerFaultDisputes / totalOrders;
  const points = Math.max(0, 1 - rate * 5) * max; // 20%+ upheld-complaint rate → 0 points
  const detail = totalDisputes === 0
    ? "No disputes filed"
    : `${buyerFaultDisputes} dispute${buyerFaultDisputes === 1 ? "" : "s"} resolved in the buyer's favor out of ${totalDisputes.toLocaleString()} filed`;
  return { key: "complaints", label: "Customer complaints", points, max, detail };
}

// --- Persistence ------------------------------------------------------------
// getTrustScoreBreakdown() above stays compute-on-read -- it's what powers
// the dashboard's full factor breakdown and needs to always reflect the
// current row data. Marketplace search is different: sorting/filtering a
// results list by Trust Score means the DB needs a real, indexed column to
// order by (see Business.trustScore in schema.prisma), not a per-row
// recompute at query time.
//
// recomputeAndPersistTrustScore() runs the same computation and writes just
// the final number to that column. Call it after anything that can move the
// score for one business: order status transitions (completedTransactions,
// cancellationRate, refundRate), dispute resolution (complaints), and
// verification decisions (verification). It's deliberately NOT called from
// every message send -- responseTime and accountAge drift slowly enough
// that the nightly backfill sweep (prisma/backfill-trust-scores.ts) keeps
// them close enough without a write-hook on every chat message.
export async function recomputeAndPersistTrustScore(businessId: string): Promise<number | null> {
  const breakdown = await getTrustScoreBreakdown(businessId);
  if (!breakdown) return null;
  await prisma.business.update({
    where: { id: businessId },
    data: { trustScore: breakdown.score, trustScoreUpdatedAt: new Date() },
  });
  return breakdown.score;
}

function accountAgeFactor(createdAt: Date): TrustScoreFactor {
  const max = WEIGHTS.accountAge;
  const months = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const points = Math.min(1, months / 12) * max; // full marks at 12+ months
  const detail = months < 1 ? "Newly joined BizNest" : `On BizNest for ${Math.floor(months)} month${Math.floor(months) === 1 ? "" : "s"}`;
  return { key: "accountAge", label: "Account age", points, max, detail };
}
