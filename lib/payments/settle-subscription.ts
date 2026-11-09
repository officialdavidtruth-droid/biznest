import { resolveSubscriptionId } from "@/lib/payments/subscription-reference";
import "server-only";
import { prisma } from "@/lib/prisma";
import { amountCoversExpected } from "@/lib/payments/amount";
import { flagPaymentForReview } from "@/lib/payments/review";
import { creditVendorReferralForPlanPayment } from "@/lib/referrals/vendor-referral";

/**
 * Subscription (BizNest plan) payment settlement for gateways that have no saved-card
 * renewals (Korapay). Called by the Korapay callback, webhook and reconciliation cron
 * once a "SUBUP-" charge verifies. Idempotent: the Payment row is claimed first with a
 * conditional update, so a replayed callback can never extend the plan twice.
 *
 * Reference shape: SUBUP-{storeId}-{subscriptionId}-{random}
 */
export type SettleSubscriptionResult =
  | { outcome: "upgraded" | "already"; storeSlug: string }
  | { outcome: "review" | "not_found"; storeSlug?: string };

export async function settleSubscriptionUpgrade(reference: string, verifiedAmountNaira: number, rawPayload: object): Promise<SettleSubscriptionResult> {
  const [, storeId, planToken] = reference.split("-");
  const subscriptionId = await resolveSubscriptionId(planToken);
  const [store, plan, payment] = await Promise.all([
    storeId ? prisma.store.findUnique({ where: { id: storeId } }) : null,
    subscriptionId ? prisma.subscription.findUnique({ where: { id: subscriptionId } }) : null,
    prisma.payment.findUnique({ where: { reference } }),
  ]);
  if (!store || !payment || payment.purpose !== "SUBSCRIPTION_UPGRADE" || payment.storeId !== store.id) return { outcome: "not_found" };
  if (payment.status === "SUCCESSFUL") return { outcome: "already", storeSlug: store.slug };

  // Money moved but doesn't match the plan: never mark it FAILED, flag it for a human.
  if (!plan || !amountCoversExpected(verifiedAmountNaira, Number(plan.price)) || !amountCoversExpected(verifiedAmountNaira, Number(payment.amount))) {
    await flagPaymentForReview(reference, "subscription payment verified but plan/amount did not match", rawPayload);
    return { outcome: "review", storeSlug: store.slug };
  }

  const claimed = await prisma.payment.updateMany({
    where: { reference, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
  });
  if (claimed.count === 0) return { outcome: "already", storeSlug: store.slug };

  // Renewing the plan they are already on extends from the current renewal date (no lost days);
  // a new plan, or a lapsed one, starts a fresh month from today.
  const now = new Date();
  const base = store.subscriptionId === plan.id && store.subscriptionRenewsAt && store.subscriptionRenewsAt > now ? new Date(store.subscriptionRenewsAt) : now;
  const nextRenewal = new Date(base);
  nextRenewal.setMonth(nextRenewal.getMonth() + 1);

  await prisma.store.update({
    where: { id: store.id },
    data: { subscriptionId: plan.id, subscriptionRenewsAt: nextRenewal, subscriptionPastDueSince: null, trialEndsAt: null,
      // Plan payments are now one-off Korapay payments: drop any old Paystack saved card so it is not auto-charged as well.
      paystackAuthorizationCode: null },
  });
  await creditVendorReferralForPlanPayment({ storeId: store.id, planId: plan.id, paymentReference: reference });
  return { outcome: "upgraded", storeSlug: store.slug };
}
