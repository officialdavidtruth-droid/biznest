import { prisma } from "@/lib/prisma";

/**
 * Free-trial expiry.
 *
 * A trial is a store on a paid plan (subscriptionId set) with a future
 * trialEndsAt and no card billing yet (subscriptionRenewsAt null). Paying
 * for a plan clears trialEndsAt (see the payment callbacks/webhooks), so a
 * store that converts is never treated as lapsed.
 *
 * When a trial ends we clear subscriptionId -- exactly like a store that
 * never paid -- so the dashboard gate sends the owner to
 * /onboarding/select-plan. trialEndsAt is deliberately LEFT in the past: it
 * is the "this store already used its trial" marker that stops the
 * self-serve trial being re-triggered (see initiatePlanUpgrade).
 */
export const TRIAL_REMINDER_DAYS = 3;

type TrialFields = {
  subscriptionId: string | null;
  trialEndsAt: Date | null;
  subscriptionRenewsAt: Date | null;
};

export function isTrialLapsed(store: TrialFields, now = new Date()): boolean {
  return Boolean(
    store.subscriptionId &&
      store.trialEndsAt &&
      store.trialEndsAt <= now &&
      !store.subscriptionRenewsAt
  );
}

/**
 * Atomically ends a lapsed trial. Returns true only for the caller that
 * actually performed the change, so the cron and the dashboard gate can race
 * safely and the owner is only notified once.
 */
export async function expireLapsedTrial(storeId: string, now = new Date()): Promise<boolean> {
  const res = await prisma.store.updateMany({
    where: {
      id: storeId,
      subscriptionId: { not: null },
      trialEndsAt: { lte: now },
      subscriptionRenewsAt: null,
    },
    data: { subscriptionId: null, subscriptionPastDueSince: null },
  });
  return res.count > 0;
}
