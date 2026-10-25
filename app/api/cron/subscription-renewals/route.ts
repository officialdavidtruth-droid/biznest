import { prisma } from "@/lib/prisma";
import { requireCronAuth } from "@/lib/cron-auth";
import { chargePaystackAuthorization, verifyPaystackTransaction } from "@/lib/payments/paystack";
import { notifyUser } from "@/lib/notifications/notify";
import { NextResponse } from "next/server";
import { expireLapsedTrial, TRIAL_REMINDER_DAYS } from "@/lib/billing/trial";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { formatMoney } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";

/**
 * Runs daily (see vercel.json, 06:00 UTC). Handles the full
 * recurring-billing loop for paid Store subscriptions:
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
 * but covers manually-granted trials/admin overrides) is skipped by the
 * charging steps -- there's nothing to charge.
 *
 * Free trials (trialEndsAt, no billing yet) are handled first: owners get a
 * heads-up 3 days out, and once trialEndsAt passes the store is dropped back
 * to unsubscribed (see lib/billing/trial.ts). The dashboard gate also checks
 * this live, so access never depends on this job having run.
 */
const GRACE_PERIOD_DAYS = 5;

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  let reminded = 0;
  let charged = 0;
  let failed = 0;
  let downgraded = 0;
  let pluginsCharged = 0;
  let pluginsSuspended = 0;
  let trialReminded = 0;
  let trialsExpired = 0;

  // --- 0a. Trial-ending reminders ---
  // Window is exactly one cron interval wide (2-3 days out) so each trial is
  // reminded once, not on every daily run.
  const trialWindowStart = new Date(now.getTime() + (TRIAL_REMINDER_DAYS - 1) * 24 * 60 * 60 * 1000);
  const trialWindowEnd = new Date(now.getTime() + TRIAL_REMINDER_DAYS * 24 * 60 * 60 * 1000);
  const endingTrials = await prisma.store.findMany({
    where: {
      trialEndsAt: { gt: trialWindowStart, lte: trialWindowEnd },
      subscriptionRenewsAt: null,
      subscriptionId: { not: null },
    },
    include: { business: true, subscription: true },
    take: 500,
  });
  for (const store of endingTrials) {
    try {
      await notifyUser({
        userId: store.business.userId,
        type: "TRIAL_ENDING_SOON",
        title: "Your free trial ends soon",
        body: `Your ${store.subscription?.name ?? ""} trial ends on ${formatDate(store.trialEndsAt)}. Subscribe before then to keep your dashboard unlocked.`,
        url: `/store/${store.slug}/admin/subscription`,
      });
      trialReminded++;
    } catch (err) {
      void logError("JOBS", "Trial reminder failed", errorMeta(err, { storeId: store.id }));
    }
  }

  // --- 0b. Expired trials -> back to unsubscribed ---
  const lapsedTrials = await prisma.store.findMany({
    where: { trialEndsAt: { lte: now }, subscriptionRenewsAt: null, subscriptionId: { not: null } },
    include: { business: true },
    take: 500,
  });
  for (const store of lapsedTrials) {
    try {
      // Atomic claim: if the dashboard gate already expired it, skip (no double notice).
      if (!(await expireLapsedTrial(store.id, now))) continue;
      await notifyUser({
        userId: store.business.userId,
        type: "TRIAL_ENDED",
        title: "Your free trial has ended",
        body: "Your dashboard is locked until you choose a plan. Your store data is safe.",
        url: store.marketingOnly ? `/store/${store.slug}/admin/subscription` : `/onboarding/select-plan?slug=${store.slug}`,
      });
      trialsExpired++;
    } catch (err) {
      void logError("JOBS", "Trial expiry failed", errorMeta(err, { storeId: store.id }));
    }
  }

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
        body: `${store.subscription?.name} (${formatMoney(Number(store.subscription?.price ?? 0))}) renews on ${formatDate(store.subscriptionRenewsAt)}. Make sure your card is up to date.`,
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
    // Deterministic per store + due date (NOT Date.now()): a retry, an overlapping
    // cron run or a crash between "charged" and "saved" re-uses the same
    // reference, so the card can never be charged twice for one renewal.
    const reference = `RENEW-${store.id}-${(store.subscriptionRenewsAt ?? now).getTime()}`;
    try {
      const prior = await verifyPaystackTransaction(reference);
      const alreadyCharged = Boolean(prior.status && prior.data?.status === "success");
      const result = alreadyCharged
        ? ({ status: true, data: { status: "success" as const } })
        : await chargePaystackAuthorization({
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
        await prisma.payment.upsert({
          where: { reference },
          update: {},
          create: {
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

  // --- 4. Marketplace app renewals ---
  // Paid marketplace apps are independent subscriptions. They use the same
  // reusable Paystack authorization as the store plan, but a failed app
  // renewal suspends only that app — the entire store must not be paused
  // because one optional plugin was not renewed.
  const duePlugins = await prisma.storePlugin.findMany({
    where: { status: "ACTIVE", renewsAt: { lte: now }, plugin: { isFree: false, billingInterval: { in: ["MONTHLY", "YEARLY"] }, status: "ACTIVE" }, store: { paystackAuthorizationCode: { not: null }, subscriptionId: { not: null } } },
    include: { plugin: true, store: { include: { business: { include: { user: true } } } } },
    take: 500,
  });

  for (const installed of duePlugins) {
    if (!installed.store.paystackAuthorizationCode) continue;
    const reference = `PLUGREN-${installed.storeId}-${installed.pluginId}-${Date.now()}`;
    try {
      const result = await chargePaystackAuthorization({
        email: installed.store.business.user.email ?? `${installed.store.slug}@biznest.space`,
        amountKobo: Math.round(Number(installed.plugin.price) * 100),
        authorizationCode: installed.store.paystackAuthorizationCode,
        reference,
      });
      if (result.status && result.data?.status === "success") {
        const nextRenewal = new Date(installed.renewsAt ?? now);
        if (installed.plugin.billingInterval === "YEARLY") nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
        else nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        const safeNext = nextRenewal > now ? nextRenewal : new Date(now.getTime() + (installed.plugin.billingInterval === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000);
        await prisma.$transaction([
          prisma.storePlugin.update({ where: { id: installed.id }, data: { renewsAt: safeNext, pastDueSince: null, lastPaymentAt: new Date(), status: "ACTIVE" } }),
          prisma.payment.create({ data: { reference, status: "SUCCESSFUL", amount: installed.plugin.price, currency: installed.plugin.currency, provider: "PAYSTACK", purpose: "PLUGIN_PURCHASE", storeId: installed.storeId, verifiedAt: new Date() } }),
        ]);
        pluginsCharged++;
      } else {
        const pastDueSince = installed.pastDueSince ?? new Date();
        const suspend = pastDueSince.getTime() <= now.getTime() - 5 * 24 * 60 * 60 * 1000;
        await prisma.storePlugin.update({ where: { id: installed.id }, data: { pastDueSince, ...(suspend ? { status: "SUSPENDED" as const } : {}) } });
        if (suspend) pluginsSuspended++;
        await notifyUser({ userId: installed.store.business.userId, type: "SUBSCRIPTION_PAYMENT_FAILED", title: `${installed.plugin.name} renewal failed`, body: `We couldn't renew ${installed.plugin.name}. The app will be suspended after the grace period.`, url: `/store/${installed.store.slug}/admin/apps` });
      }
    } catch (err) {
      void logError("JOBS", "Plugin renewal failed", errorMeta(err, { storeId: installed.storeId, pluginId: installed.pluginId }));
    }
  }

  void logInfo("JOBS", "Subscription renewal sweep complete", { reminded, charged, failed, downgraded, pluginsCharged, pluginsSuspended, trialReminded, trialsExpired });
  return NextResponse.json({ reminded, charged, failed, downgraded, pluginsCharged, pluginsSuspended, trialReminded, trialsExpired });
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
