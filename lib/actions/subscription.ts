"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeCustomer } from "@/lib/payments/gateway";
import { getFreeTrialSetting } from "@/lib/actions/site-settings";
import { nanoid } from "nanoid";
import type { ActionResult } from "@/types/actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.biznest.space";

/**
 * Reference encodes storeId + subscriptionId directly rather than needing a
 * new "pending upgrade" table — the callback route parses it back out. Kept
 * deliberately separate from the Order payment flow/reference format so the
 * two can never be confused with each other.
 */
function buildReference(storeId: string, subscriptionId: string) {
  return `SUBUP-${storeId}-${subscriptionId}-${nanoid(8)}`;
}

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
  if (store.subscriptionId === plan.id) return { success: false, error: "You're already on this plan." };

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
  const isFirstPlanChoice = !store.subscriptionId;
  const trialSetting = await getFreeTrialSetting();
  const trialApplies = isFirstPlanChoice && trialSetting.enabled && trialSetting.planId === plan.id;
  if (trialApplies) {
    const trialEndsAt = new Date(Date.now() + trialSetting.days * 24 * 60 * 60 * 1000);
    await prisma.store.update({
      where: { id: store.id },
      data: { subscriptionId: plan.id, trialEndsAt },
    });
    return { success: true, data: { trialStarted: true } };
  }

  const reference = buildReference(store.id, plan.id);

  // Platform-billing (subscription upgrades) always goes through Paystack,
  // regardless of whichever gateway supaadmin has toggled "active" for
  // store checkout — see the `gateway` override on chargeCustomer. This is
  // deliberate: the two purposes must never share the same switch again.
  const callbackUrl = `${APP_URL}/api/payments/paystack/subscription-callback`;

  // No subaccount passed — this charge goes straight to the platform
  // account, unlike order payments which split to the vendor's subaccount.
  const charge = await chargeCustomer({
    email: session.user.email ?? `${store.slug}@biznest.space`,
    amountNaira: Number(plan.price),
    reference,
    callbackUrl,
    gateway: "PAYSTACK",
  });

  if (!charge.success) {
    return { success: false, error: charge.error };
  }

  // Same audit-trail row as order checkout — see the matching comment in
  // lib/actions/order.ts.
  await prisma.payment.create({
    data: {
      storeId: store.id,
      purpose: "SUBSCRIPTION_UPGRADE",
      provider: charge.gateway,
      reference,
      status: "PENDING",
      amount: plan.price,
      currency: "NGN",
    },
  });

  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}
