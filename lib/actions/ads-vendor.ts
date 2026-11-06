"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { chargeCustomer, PLATFORM_BILLING_GATEWAY } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { APP_URL } from "@/lib/constants/app-url";
import { AD_MAX_ACTIVE_PER_STORE, adReference, sanitizeAd, type AdInput } from "@/lib/ads";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  const a = await assertStorePermission(slug, "marketing");
  if (!a.success) return a;
  if (a.store.status !== "ACTIVE") return { success: false as const, error: "Your store must be active to run ads." };
  return a;
}

const refresh = (slug: string) => { revalidatePath(`/store/${slug}/admin/ads`); revalidatePath("/browse"); };

/** Where the browser goes to pay. The callback routes are shared by both gateways, like app purchases. */
async function startCheckout(slug: string, store: { id: string; slug: string }, campaignId: string, amount: number): Promise<ActionResult<{ authorizationUrl: string }>> {
  const reference = adReference(campaignId, nanoid(8));
  await prisma.adCampaign.update({ where: { id: campaignId }, data: { paymentReference: reference } });
  await createPendingPayment({ storeId: store.id, purpose: "AD_CAMPAIGN", provider: PLATFORM_BILLING_GATEWAY, reference, amount, currency: "NGN" });
  const session = await auth();
  const charge = await chargeCustomer({
    email: session?.user?.email ?? `${store.slug}@biznest.space`,
    amountNaira: amount,
    reference,
    callbackUrl: `${APP_URL}/api/payments/korapay/ad-callback?slug=${encodeURIComponent(slug)}`,
    gateway: PLATFORM_BILLING_GATEWAY,
  });
  if (!charge.success) {
    await markPaymentFailed(reference);
    return { success: false, error: charge.error };
  }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway } });
  return { success: true, data: { authorizationUrl: charge.authorizationUrl } };
}

/** Create a campaign and send the owner to pay. It only starts running once the payment is confirmed. */
export async function createAdCampaign(slug: string, input: AdInput & { productId?: string | null }): Promise<ActionResult<{ authorizationUrl: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const parsed = sanitizeAd(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { ad } = parsed;

  const open = await prisma.adCampaign.count({ where: { storeId: a.store.id, status: { in: ["ACTIVE", "PAUSED", "PENDING_PAYMENT"] } } });
  if (open >= AD_MAX_ACTIVE_PER_STORE) return { success: false, error: `You can have up to ${AD_MAX_ACTIVE_PER_STORE} ads open at once. Finish or remove one first.` };

  let product: { id: string; name: string; price: unknown; currency: string } | null = null;
  if (input.productId) {
    product = await prisma.product.findFirst({ where: { id: input.productId, storeId: a.store.id, isPublished: true, archivedAt: null }, select: { id: true, name: true, price: true, currency: true } });
    if (!product) return { success: false, error: "That product isn't available to promote." };
  }

  const campaign = await prisma.adCampaign.create({
    data: {
      storeId: a.store.id, placement: ad.placement, caption: ad.caption, imageUrl: ad.imageUrl, bgColor: ad.bgColor, ctaLabel: ad.ctaLabel,
      budget: ad.budget, rateNaira: ad.rate, impressionsBought: ad.impressions, durationDays: ad.durationDays,
      ...(product ? { productId: product.id, productName: product.name, productPrice: product.price as number, productCurrency: product.currency } : {}),
    },
    select: { id: true },
  });
  const checkout = await startCheckout(slug, a.store, campaign.id, ad.budget);
  if (!checkout.success) await prisma.adCampaign.delete({ where: { id: campaign.id } }).catch(() => undefined);
  refresh(slug);
  return checkout;
}

/** Pay again for a campaign that was created but not paid (closed the checkout, card declined). */
export async function payAdCampaign(slug: string, campaignId: string): Promise<ActionResult<{ authorizationUrl: string }>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const c = await prisma.adCampaign.findFirst({ where: { id: campaignId, storeId: a.store.id, status: "PENDING_PAYMENT" }, select: { id: true, budget: true } });
  if (!c) return { success: false, error: "This campaign isn't waiting for payment." };
  return startCheckout(slug, a.store, c.id, Number(c.budget));
}

export async function setAdPaused(slug: string, campaignId: string, paused: boolean): Promise<ActionResult> {
  const a = await assertStorePermission(slug, "marketing");
  if (!a.success) return { success: false, error: a.error };
  const where = paused
    ? { id: campaignId, storeId: a.store.id, status: "ACTIVE" }
    : { id: campaignId, storeId: a.store.id, status: "PAUSED", pausedBy: "OWNER" }; // only the owner's own pause can be undone by the owner
  const res = await prisma.adCampaign.updateMany({ where, data: paused ? { status: "PAUSED", pausedBy: "OWNER" } : { status: "ACTIVE", pausedBy: null } });
  if (res.count === 0) return { success: false, error: paused ? "That ad isn't running." : "Only ads you paused yourself can be resumed. Contact support for the others." };
  refresh(slug);
  return { success: true, data: undefined };
}

/** Throw away an unpaid draft. Paid campaigns can only be paused (their budget is spent by delivery). */
export async function discardUnpaidAd(slug: string, campaignId: string): Promise<ActionResult> {
  const a = await assertStorePermission(slug, "marketing");
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.adCampaign.deleteMany({ where: { id: campaignId, storeId: a.store.id, status: "PENDING_PAYMENT" } });
  if (res.count === 0) return { success: false, error: "Only unpaid ads can be discarded." };
  refresh(slug);
  return { success: true, data: undefined };
}
