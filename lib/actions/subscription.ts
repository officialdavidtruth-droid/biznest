"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializePaystackTransaction } from "@/lib/payments/paystack";
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
): Promise<ActionResult<{ authorizationUrl: string }>> {
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

  const reference = buildReference(store.id, plan.id);
  const init = await initializePaystackTransaction({
    email: session.user.email ?? `${store.slug}@biznest.space`,
    amountKobo: Math.round(Number(plan.price) * 100),
    reference,
    callbackUrl: `${APP_URL}/api/payments/paystack/subscription-callback`,
    // No subaccountCode — this charge goes straight to the platform account,
    // unlike order payments which split to the vendor's subaccount.
  });

  if (!init.status || !init.data) {
    return { success: false, error: init.message || "Couldn't start the upgrade payment." };
  }

  return { success: true, data: { authorizationUrl: init.data.authorization_url } };
}
