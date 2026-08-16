import { prisma } from "@/lib/prisma";
import { chargePaystackAuthorization } from "@/lib/payments/paystack";
import { notifyUser } from "@/lib/notifications/notify";
import { NextResponse } from "next/server";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";

/**
 * Runs daily (see vercel.json). Handles the full recurring-billing loop for
 * paid Store subscriptions:
 *
 *  1. Reminds owners 3 days before a renewal charge, so an expiring/expired
 *     card can be updated before money is actually due (see
 *     subscriptionRenewsAt on Store).
 *  2. On the renewal date itself, charges the saved Paystack authorization
 *     automatically -- this is what actually makes "monthly subscription"
 *     real instead of a one-time payment that happens to be called that.
 *  3. On charge failure, starts a 5-day grace period (subscriptionPastDueSince)
 *     and notifies the owner to fix their card.
 *  4. If a store is still past-due after the grace period, it's dropped back
 *     to unsubscribed (subscriptionId cleared) -- the dashboard gate in
 *     app/store/[slug]/admin/layout.tsx then bounces them back to
 *     /onboarding/select-plan, same as a store that never paid.
 *
 * A store with no paystackAuthorizationCode (shouldn't happen post-checkout,
 * but covers manually-granted trials/admin overrides) is skipped entirely --
 * there's nothing to charge, and admin-granted access isn't this job's business.
 */
const GRACE_PERIOD_DAYS = 5;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  let reminded = 0;
  let charged = 0;
  let failed = 0;
  let downgraded = 0;

  // --- 1. Upcoming-renewal reminders (3-day heads up, not yet due) ---
  const upcoming = await prisma.store.findMany({
    where: {
      subscriptionRenewsAt: { gt: now, lte: in3Days },
      subscriptionPastDueSince: null,
      subscriptionId: { not: null },
    },
    include: { business: true, subscription: true },
    take: 500,
  });
  for (const store of upcoming) {
    try {
      await notifyUser({
        userId: store.business.userId,
        type: "SUBSCRIPTION_RENEWING_SOON",
        title: "Your plan renews soon",
        body: `${store.subscription?.name} (₦${Number(store.subscription?.price ?? 0).toLocaleString()}) renews on ${store.subscriptionRenewsAt?.toLocaleDateString()}. Make sure your card is up to date.`,
        url: `/store/${store.slug}/admin/subscription`,
      });
      reminded++;
    } catch (err) {
      void logError("JOBS", "Renewal reminder failed", errorMeta(err, { storeId: store.id }));
    }
  }

  // --- 2. Due-today renewals: actually charge ---
  const due = await prisma.store.findMany({
    where: {
      subscriptionRenewsAt: { lte: now },
      subscriptionId: { not: null },
      paystackAuthorizationCode: { not: null },
    },
    include: { business: { include: { user: true } }, subscription: true },
    take: 500,
  });

  for (const store of due) {
    if (!store.subscription || !store.paystackAuthorizationCode) continue;
    const reference = `RENEW-${store.id}-${Date.now()}`;
    try {
      const result = await chargePaystackAuthorization({
        email: store.business.user.email ?? `${store.slug}@biznest.space`,
        amountKobo: Math.round(Number(store.subscription.price) * 100),
        authorizationCode: store.paystackAuthorizationCode,
        reference,
      });

      if (result.status && result.data?.status === "success") {
        const nextRenewal = new Date(store.subscriptionRenewsAt ?? now);
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        // Guard against a clock/scheduling gap leaving the next date in the
        // past (e.g. cron didn't run for a few days) -- always push forward
        // from now at minimum.
        const safeNext = nextRenewal > now ? nextRenewal : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await prisma.store.update({
          where: { id: store.id },
          data: { subscriptionRenewsAt: safeNext, subscriptionPastDueSince: null },
        });
        await prisma.payment.create({
          data: {
            reference,
            status: "SUCCESSFUL",
            amount: store.subscription.price,
            currency: "NGN",
            provider: "PAYSTACK",
            purpose: "SUBSCRIPTION_RENEWAL" as const,
            storeId: store.id,
            verifiedAt: new Date(),
          },
        });
        charged++;
      } else {
        await handleRenewalFailure(store, graceCutoff);
        failed++;
      }
    } catch (err) {
      void logError("JOBS", "Renewal charge failed", errorMeta(err, { storeId: store.id }));
      await handleRenewalFailure(store, graceCutoff).catch(() => {});
      failed++;
    }
  }

  // --- 3. Past-due beyond grace period -> downgrade ---
  const overdue = await prisma.store.findMany({
    where: { subscriptionPastDueSince: { lte: graceCutoff }, subscriptionId: { not: null } },
    include: { business: true },
    take: 500,
  });
  for (const store of overdue) {
    try {
      await prisma.store.update({
        where: { id: store.id },
        data: { subscriptionId: null, subscriptionPastDueSince: null, subscriptionRenewsAt: null },
      });
      await notifyUser({
        userId: store.business.userId,
        type: "SUBSCRIPTION_DOWNGRADED",
        title: "Your store has been paused",
        body: "We couldn't renew your plan after several attempts. Your dashboard is locked until you subscribe again — your store data is safe.",
        url: `/onboarding/select-plan?slug=${store.slug}`,
      });
      downgraded++;
    } catch (err) {
      void logError("JOBS", "Downgrade failed", errorMeta(err, { storeId: store.id }));
    }
  }

  void logInfo("JOBS", "Subscription renewal sweep complete", { reminded, charged, failed, downgraded });
  return NextResponse.json({ reminded, charged, failed, downgraded });
}

async function handleRenewalFailure(
  store: { id: string; slug: string; subscriptionPastDueSince: Date | null; business: { userId: string } },
  graceCutoff: Date
) {
  // Only start the grace-period clock the first time this fails, so a
  // second failed attempt a day later doesn't reset the countdown.
  const pastDueSince = store.subscriptionPastDueSince ?? new Date();
  await prisma.store.update({ where: { id: store.id }, data: { subscriptionPastDueSince: pastDueSince } });

  await notifyUser({
    userId: store.business.userId,
    type: "SUBSCRIPTION_PAYMENT_FAILED",
    title: "We couldn't renew your plan",
    body: "Your card was declined. Please update your payment details or your dashboard will be paused in a few days.",
    url: `/store/${store.slug}/admin/subscription`,
  });
}
