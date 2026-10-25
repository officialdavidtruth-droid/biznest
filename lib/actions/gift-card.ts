"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { roundMoney } from "@/lib/utils/pricing";
import { issueGiftCard, redeemGiftCard, normalizeGiftCardCode } from "@/lib/payments/gift-card-ledger";
import type { ActionResult } from "@/types/actions";

// Gift cards are stored value, so they sit behind the same "marketing"
// permission as coupons. In-store redemption also accepts "pos" so a cashier
// without marketing access can still take a card as payment.
const MAX_CARD_AMOUNT = 5_000_000;

async function adminAccess(slug: string) {
  return assertStorePermission(slug, "marketing");
}

async function redeemAccess(slug: string) {
  const marketing = await assertStorePermission(slug, "marketing");
  if (marketing.success) return marketing;
  return assertStorePermission(slug, "pos");
}

export async function issueGiftCardAction(
  slug: string,
  formData: FormData
): Promise<ActionResult<{ code: string }>> {
  const access = await adminAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const rate = await checkRateLimit(`giftcard-issue:${access.store.id}`, 60, 10 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many cards issued — try again shortly." };

  const amount = roundMoney(Number(formData.get("amount") ?? 0));
  if (!(amount > 0) || amount > MAX_CARD_AMOUNT) {
    return { success: false, error: `Enter an amount between ₦1 and ₦${MAX_CARD_AMOUNT.toLocaleString()}.` };
  }

  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim().toLowerCase();
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { success: false, error: "That recipient email doesn't look right." };
  }

  const expiryRaw = String(formData.get("expiresAt") ?? "").trim();
  let expiresAt: Date | null = null;
  if (expiryRaw) {
    expiresAt = new Date(`${expiryRaw}T23:59:59`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return { success: false, error: "Expiry date must be in the future." };
    }
  }

  const session = await auth();
  const card = await issueGiftCard({
    storeId: access.store.id,
    amount,
    expiresAt,
    recipientName: String(formData.get("recipientName") ?? "").trim().slice(0, 120) || null,
    recipientEmail: recipientEmail || null,
    message: String(formData.get("message") ?? "").trim().slice(0, 500) || null,
    issuedById: session?.user?.id ?? null,
  });

  revalidatePath(`/store/${slug}/admin/gift-cards`);
  return { success: true, data: { code: card.code } };
}

export async function setGiftCardStatusAction(
  slug: string,
  cardId: string,
  status: "ACTIVE" | "DISABLED"
): Promise<ActionResult<void>> {
  const access = await adminAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  // storeId in the where clause: a card id from another store must not match.
  const updated = await prisma.giftCard.updateMany({ where: { id: cardId, storeId: access.store.id }, data: { status } });
  if (updated.count !== 1) return { success: false, error: "Gift card not found." };
  revalidatePath(`/store/${slug}/admin/gift-cards`);
  return { success: true, data: undefined };
}

/** Staff takes a gift card as payment for an in-person sale. */
export async function redeemGiftCardInStoreAction(
  slug: string,
  formData: FormData
): Promise<ActionResult<{ redeemed: number; balanceAfter: number }>> {
  const access = await redeemAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const rate = await checkRateLimit(`giftcard-redeem:${access.store.id}`, 60, 10 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many attempts — try again shortly." };

  const session = await auth();
  const result = await redeemGiftCard({
    storeId: access.store.id,
    code: String(formData.get("code") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    note: String(formData.get("note") ?? "").trim().slice(0, 200) || "Redeemed in store",
    createdById: session?.user?.id ?? null,
  });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/store/${slug}/admin/gift-cards`);
  return { success: true, data: { redeemed: result.redeemed, balanceAfter: result.balanceAfter } };
}

/**
 * Public balance check (anyone holding a code). Rate limited per IP and per
 * store because a code is the only secret; the response carries only balance
 * and expiry -- never the recipient's name or email.
 */
export async function checkGiftCardBalance(
  slug: string,
  code: string
): Promise<ActionResult<{ balance: number; currency: string; expiresAt: string | null }>> {
  const ip = getClientIp(await headers());
  const rate = await checkRateLimit(`giftcard-balance:${slug}:${ip}`, 10, 10 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many attempts — try again in a few minutes." };

  const normalized = normalizeGiftCardCode(code);
  if (!normalized) return { success: false, error: "Enter your gift card code." };

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return { success: false, error: "That gift card isn't valid." };

  const card = await prisma.giftCard.findUnique({ where: { storeId_code: { storeId: store.id, code: normalized } } });
  const expired = card?.expiresAt ? card.expiresAt < new Date() : false;
  if (!card || card.status !== "ACTIVE" || expired) return { success: false, error: "That gift card isn't valid." };

  return {
    success: true,
    data: { balance: Number(card.balance), currency: card.currency, expiresAt: card.expiresAt ? card.expiresAt.toISOString() : null },
  };
}

/**
 * Cards addressed to the signed-in customer's email. Only for verified emails:
 * store accounts can be created with any address, so showing codes to an
 * unverified one would let anyone read a gift meant for someone else.
 */
export async function listMyGiftCards(slug: string) {
  const membership = await requireStoreCustomer(slug);
  if (!membership) return [];
  const user = await prisma.user.findUnique({ where: { id: membership.userId }, select: { email: true, emailVerified: true } });
  if (!user?.email || !user.emailVerified) return [];
  return prisma.giftCard.findMany({
    where: { storeId: membership.storeId, recipientEmail: user.email.toLowerCase(), status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, balance: true, currency: true, expiresAt: true, message: true, createdAt: true },
  });
}
