"use server";

import { acquirePaymentInitLock, PAYMENT_ALREADY_STARTING } from "@/lib/payments/init-lock";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingCallbackUrl, chargeCustomer, getBillingGateway } from "@/lib/payments/gateway";
import { getFreeTrialSetting, getMarketingFreeTrialSetting } from "@/lib/actions/site-settings";
import { buildSubscriptionReference } from "@/lib/payments/subscription-reference";
import type { ActionResult } from "@/types/actions";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";


/**
 * Reference encodes storeId + subscriptionId directly rather than needing a
 * new "pending upgrade" table — the callback route parses it back out. Kept
 * deliberately separate from the Order payment flow/reference format so the
 * two can never be confused with each other.
 */

export async function initiatePlanUpgrade(
  slug: string,
  subscriptionId: string
): Promise<ActionResult<{ authorizationUrl: string } | { trialStarted: true }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };
  if (store.business.userId !== session.user.id) {
    return { success: false, error: "You don't have access to this store." };
  }

  const plan = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!plan || !plan.isActive) return { success: false, error: "That plan isn't available." };
  // Plan payments are one-off Korapay payments (no saved card), so the plan you are on can be
  // renewed once it is within a week of expiring (or has expired).
  const renewable = store.subscriptionId === plan.id && Number(plan.price) > 0 && !!store.subscriptionRenewsAt && store.subscriptionRenewsAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (store.subscriptionId === plan.id && !renewable) return { success: false, error: "You're already on this plan." };

  if (Number(plan.price) === 0) {
    // Free tier — no charge needed, just switch immediately.
    await prisma.store.update({ where: { id: store.id }, data: { subscriptionId: plan.id } });
    return { success: false, error: "Switched to Free — refresh to see it reflected." };
  }

  // Self-serve free trial — SupaAdmin controls both whether this is on at
  // all and which single plan it applies to (billing.free_trial platform
  // setting, edited at /supaadmin/settings). Only applies the first time a
  // store picks a plan at all (store.subscriptionId is still null here) --
  // switching *into* this plan later from another paid plan still goes
  // through the normal charge below, and a store can only ever get this
  // trial once (this same check blocks re-triggering it by downgrading
  // back to this plan after the trial ends).
  // trialEndsAt is kept (in the past) after a trial lapses, so it also marks "trial already used".
  const isFirstPlanChoice = !store.subscriptionId && !store.trialEndsAt;
  const trialSetting = store.marketingOnly ? await getMarketingFreeTrialSetting() : await getFreeTrialSetting();
  const trialApplies = isFirstPlanChoice && trialSetting.enabled && trialSetting.planId === plan.id;
  if (trialApplies) {
    const trialEndsAt = new Date(Date.now() + trialSetting.days * 24 * 60 * 60 * 1000);
    await prisma.store.update({
      where: { id: store.id },
      data: { subscriptionId: plan.id, trialEndsAt },
    });
    return { success: true, data: { trialStarted: true } };
  }

  if (!(await acquirePaymentInitLock(`sub:${store.id}`))) return { success: false, error: PAYMENT_ALREADY_STARTING };
  const reference = buildSubscriptionReference(store.id, plan.id);
  const billingGateway = await getBillingGateway();
  await createPendingPayment({ storeId: store.id, purpose: "SUBSCRIPTION_UPGRADE", provider: billingGateway, reference, amount: Number(plan.price), currency: "NGN" });

  // Plan payments follow the gateway chosen in SupaAdmin, same as store checkout.
  const callbackUrl = billingCallbackUrl("subscription", undefined, billingGateway);

  // No subaccount passed — this charge goes straight to the platform
  // account, unlike order payments which split to the vendor's subaccount.
  const charge = await chargeCustomer({
    email: session.user.email ?? `${store.slug}@biznest.space`,
    amountNaira: Number(plan.price),
    reference,
    callbackUrl,
    gateway: billingGateway,
  });

  if (!charge.success) {
    await markPaymentFailed(reference);
    return { success: false, error: charge.error };
  }

  // Same audit-trail row as order checkout — see the matching comment in
  // lib/actions/order.ts.
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway } });

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}
