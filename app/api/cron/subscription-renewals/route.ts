import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { notifyUser } from "@/lib/notifications/notify";
import { NextResponse } from "next/server";
import { expireLapsedTrial, TRIAL_REMINDER_DAYS } from "@/lib/billing/trial";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { formatMoney } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";

/**
 * Runs daily (see vercel.json, 06:00 UTC). Every in-app purchase (plans and apps) is paid through
 * Korapay as a one-off payment, so nothing is charged automatically here:
 *
 *  1. Reminds owners 3 days before a plan expires so they can renew from the subscription page.
 *  2. When a plan lapses, starts the 5-day grace period and tells the owner to renew.
 *  3. After the grace period the store is dropped back to unsubscribed (subscriptionId cleared) and the
 *     dashboard gate bounces it to /onboarding/select-plan.
 *  3b. Apps the current plan no longer includes are suspended.
 *  4. Lapsed apps get a notice, then are suspended after the grace period.
 *
 * Free trials (trialEndsAt) are handled first: heads-up 3 days out, then the store is dropped back to
 * unsubscribed (see lib/billing/trial.ts). The dashboard gate also checks this live.
 */
const GRACE_PERIOD_DAYS = 5;

export const GET = withCronMonitor("subscription-renewals", async (_req, ctx) => {

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
        body: `${store.subscription?.name} (${formatMoney(Number(store.subscription?.price ?? 0))}) expires on ${formatDate(store.subscriptionRenewsAt)}. Renew it from your subscription page to keep your dashboard unlocked.`,
        url: `/store/${store.slug}/admin/subscription`,
      });
      reminded++;
    } catch (err) {
      void logError("JOBS", "Renewal reminder failed", errorMeta(err, { storeId: store.id }));
    }
  }

  // --- 2b. Plans paid through Korapay have no saved card to charge: when one lapses, start the
  // grace period and ask the owner to renew from the subscription page. Step 3 pauses it if they don't.
  const lapsed = await prisma.store.findMany({
    where: { subscriptionRenewsAt: { lte: now }, subscriptionId: { not: null }, subscriptionPastDueSince: null },
    include: { business: true, subscription: true },
    take: 500,
  });
  for (const store of lapsed) {
    try {
      await prisma.store.update({ where: { id: store.id }, data: { subscriptionPastDueSince: now } });
      await notifyUser({
        userId: store.business.userId,
        type: "SUBSCRIPTION_PAYMENT_FAILED",
        title: "Your plan has expired",
        body: `Renew ${store.subscription?.name ?? "your plan"} within ${GRACE_PERIOD_DAYS} days to keep your dashboard unlocked.`,
        url: `/store/${store.slug}/admin/subscription`,
      });
      failed++;
    } catch (err) {
      void logError("JOBS", "Lapsed-plan notice failed", errorMeta(err, { storeId: store.id }));
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
      ctx.fail("Downgrade of an overdue store failed", { storeId: store.id });
    }
  }

  // --- 3b. Suspend paid apps the store's current plan no longer includes ---
  // A downgrade used to leave these ACTIVE and still billed while getPluginEntitlement
  // locked them. Suspend them here, before any app is charged below.
  const planLocked = await prisma.storePlugin.findMany({
    where: { status: "ACTIVE", plugin: { isFree: false, status: "ACTIVE" }, store: { subscriptionId: { not: null } } },
    select: { id: true, storeId: true, plugin: { select: { name: true, planAccess: { where: { enabled: true }, select: { subscriptionId: true } } } }, store: { select: { slug: true, subscriptionId: true, business: { select: { userId: true } } } } },
    take: 2000,
  });
  for (const row of planLocked) {
    if (row.plugin.planAccess.some((p) => p.subscriptionId === row.store.subscriptionId)) continue;
    try {
      await prisma.storePlugin.update({ where: { id: row.id }, data: { status: "SUSPENDED" } });
      pluginsSuspended++;
      await notifyUser({
        userId: row.store.business.userId,
        type: "SUBSCRIPTION_PAYMENT_FAILED",
        title: `${row.plugin.name} was turned off`,
        body: `Your current plan doesn't include ${row.plugin.name}, so it was suspended and won't be billed. Upgrade your plan to use it again.`,
        url: `/store/${row.store.slug}/admin/apps`,
      });
    } catch (err) {
      void logError("JOBS", "Plan-locked app suspension failed", errorMeta(err, { storeId: row.storeId }));
    }
  }

  // --- 4. Marketplace app renewals ---
  // All in-app purchases (plans and apps) are paid through Korapay as one-off payments, so there is no
  // saved card to charge automatically. Lapsed apps are handled by 4b below.

  // --- 4b. App renewals (apps are paid through Korapay; there is no saved card to charge) ---
  // The app keeps working through a 5-day grace period; the owner is told once and can renew from
  // the Apps page. After the grace period only that app is suspended.
  const lapsedPlugins = await prisma.storePlugin.findMany({
    where: { status: "ACTIVE", renewsAt: { lte: now }, plugin: { isFree: false, billingInterval: { in: ["MONTHLY", "YEARLY"] }, status: "ACTIVE" }, },
    include: { plugin: true, store: { include: { business: true } } },
    take: 500,
  });
  for (const installed of lapsedPlugins) {
    try {
      const pastDueSince = installed.pastDueSince ?? now;
      const suspend = pastDueSince.getTime() <= now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
      await prisma.storePlugin.update({ where: { id: installed.id }, data: { pastDueSince, ...(suspend ? { status: "SUSPENDED" as const } : {}) } });
      if (suspend) pluginsSuspended++;
      if (!installed.pastDueSince || suspend) {
        await notifyUser({
          userId: installed.store.business.userId,
          type: "SUBSCRIPTION_PAYMENT_FAILED",
          title: suspend ? `${installed.plugin.name} has been suspended` : `${installed.plugin.name} has expired`,
          body: suspend ? `Renew ${installed.plugin.name} from the Apps page to turn it back on.` : `Renew ${installed.plugin.name} from the Apps page within ${GRACE_PERIOD_DAYS} days to keep it running.`,
          url: `/store/${installed.store.slug}/admin/apps`,
        });
      }
    } catch (err) {
      void logError("JOBS", "Lapsed app notice failed", errorMeta(err, { storeId: installed.storeId, pluginId: installed.pluginId }));
    }
  }

  void logInfo("JOBS", "Subscription renewal sweep complete", { reminded, charged, failed, downgraded, pluginsCharged, pluginsSuspended, trialReminded, trialsExpired });
  return NextResponse.json({ reminded, charged, failed, downgraded, pluginsCharged, pluginsSuspended, trialReminded, trialsExpired });
});
