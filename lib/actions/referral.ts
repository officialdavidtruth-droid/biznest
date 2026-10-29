"use server";

import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { attachReferral, getOrCreateReferralCode } from "@/lib/referrals/attach";
import { cancelPendingReferral, reconcileReferral } from "@/lib/payments/referral-award";
import { APP_URL } from "@/lib/constants/app-url";
import { logError, errorMeta } from "@/lib/observability/log";
import type { ActionResult } from "@/types/actions";
import { formatNumber } from "@/lib/i18n/locale";

const MAX_REWARD_POINTS = 1_000_000;
const MAX_MIN_ORDER = 100_000_000;
const MAX_EXPIRY_DAYS = 3650;

function maskName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  if (!first) return "A friend";
  return first.length <= 2 ? first : `${first.slice(0, 1)}${"•".repeat(Math.min(first.length - 1, 4))}`;
}

// --- Customer-facing ------------------------------------------------------

type MyReferralInfo = {
  enabled: boolean;
  referrerPoints: number;
  refereePoints: number;
  code: string | null;
  shareUrl: string | null;
  appliedCode: boolean;
  minOrderAmount: number;
  referrals: { id: string; status: "PENDING" | "REWARDED" | "CANCELLED" | "REVERSED"; points: number; createdAt: Date; friend: string }[];
};

export async function getMyReferralInfo(slug: string): Promise<MyReferralInfo | null> {
  const membership = await requireStoreCustomer(slug);
  if (!membership) return null;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true, referralEnabled: true, referralReferrerPoints: true, referralRefereePoints: true, referralMinOrderAmount: true,
      customDomain: true, customDomainStatus: true,
    },
  });
  if (!store) return null;

  const base = {
    minOrderAmount: Number(store.referralMinOrderAmount ?? 0),
    enabled: store.referralEnabled,
    referrerPoints: store.referralReferrerPoints,
    refereePoints: store.referralRefereePoints,
  };
  if (!store.referralEnabled) return { ...base, code: null, shareUrl: null, referrals: [], appliedCode: false };

  const code = await getOrCreateReferralCode(store.id, membership.userId);
  const [referrals, applied] = await Promise.all([
    prisma.referral.findMany({
      where: { storeId: store.id, referrerId: membership.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, status: true, referrerPoints: true, createdAt: true, referee: { select: { name: true } } },
    }),
    prisma.referral.findUnique({
      where: { storeId_refereeId: { storeId: store.id, refereeId: membership.userId } },
      select: { id: true },
    }),
  ]);

  return {
    ...base,
    code: code.code,
    // Stores with a verified custom domain share their own domain, not the platform's.
    shareUrl: `${store.customDomain && store.customDomainStatus === "VERIFIED" ? `https://${store.customDomain}` : APP_URL}/register?store=${encodeURIComponent(slug)}&ref=${code.code}`,
    appliedCode: Boolean(applied),
    referrals: referrals.map((r) => ({
      id: r.id,
      status: r.status,
      points: r.referrerPoints,
      createdAt: r.createdAt,
      // Referrers see a masked first name only -- not another customer's full identity.
      friend: maskName(r.referee.name),
    })),
  };
}

export async function applyReferralCodeAction(slug: string, code: string): Promise<ActionResult<void>> {
  const membership = await requireStoreCustomer(slug);
  if (!membership) return { success: false, error: "Please sign in to apply a referral code." };

  const rate = await checkRateLimit(`referral-apply:${membership.userId}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many attempts — try again later." };

  const result = await attachReferral({ storeId: membership.storeId, refereeId: membership.userId, code });
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/store/${slug}/account/referrals`);
  return { success: true, data: undefined };
}

// --- Merchant-facing ------------------------------------------------------

export async function updateReferralSettingsAction(
  slug: string,
  input: { enabled: boolean; referrerPoints: number; refereePoints: number; minOrderAmount: number; maxRewardsPerReferrer: number; expiryDays: number }
): Promise<ActionResult<void>> {
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { success: false, error: access.error };

  const { referrerPoints, refereePoints } = input;
  const valid = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_REWARD_POINTS;
  if (!valid(referrerPoints) || !valid(refereePoints)) {
    return { success: false, error: `Rewards must be whole numbers between 0 and ${formatNumber(MAX_REWARD_POINTS)} points.` };
  }
  if (input.enabled && referrerPoints === 0 && refereePoints === 0) {
    return { success: false, error: "Set a reward for at least one side, or switch the program off." };
  }

  const { minOrderAmount, maxRewardsPerReferrer, expiryDays } = input;
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0 || minOrderAmount > MAX_MIN_ORDER) {
    return { success: false, error: "Minimum order must be zero or a positive amount." };
  }
  if (!Number.isInteger(maxRewardsPerReferrer) || maxRewardsPerReferrer < 0 || maxRewardsPerReferrer > 100_000) {
    return { success: false, error: "Reward limit must be a whole number (0 means no limit)." };
  }
  if (!Number.isInteger(expiryDays) || expiryDays < 0 || expiryDays > MAX_EXPIRY_DAYS) {
    return { success: false, error: `Expiry must be a whole number of days up to ${MAX_EXPIRY_DAYS} (0 means never).` };
  }

  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      referralEnabled: input.enabled,
      referralReferrerPoints: referrerPoints,
      referralRefereePoints: refereePoints,
      referralMinOrderAmount: Math.round(minOrderAmount * 100) / 100,
      referralMaxRewardsPerReferrer: maxRewardsPerReferrer,
      referralExpiryDays: expiryDays,
    },
  });
  revalidatePath(`/store/${slug}/admin/referrals`);
  return { success: true, data: undefined };
}

/** Cancels a referral the merchant believes is fake. Only PENDING referrals can be cancelled; paid ones are reversed by refunding the order. */
export async function cancelReferralAction(slug: string, referralId: string, reason?: string): Promise<ActionResult<void>> {
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { success: false, error: access.error };

  const note = (reason ?? "").trim().slice(0, 200) || "Cancelled by the store.";
  const ok = await cancelPendingReferral(referralId, access.store.id, note);
  if (!ok) return { success: false, error: "Only referrals that are still waiting can be cancelled." };
  await logActivity({ storeId: access.store.id, role: access.role, action: "referral.cancelled", target: referralId, metadata: { reason: note } });

  revalidatePath(`/store/${slug}/admin/referrals`);
  revalidatePath(`/store/${slug}/account/referrals`);
  return { success: true, data: undefined };
}

/** "Pay now" / retry for a PENDING referral whose reward didn't go out (failure, hold, or program was paused). */
export async function retryReferralPayoutAction(slug: string, referralId: string): Promise<ActionResult<{ message: string }>> {
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { success: false, error: access.error };

  let outcome;
  try {
    outcome = await reconcileReferral(referralId, access.store.id);
  } catch (err) {
    await logError("JOBS", "Referral manual payout failed", errorMeta(err, { referralId, storeId: access.store.id }));
    return { success: false, error: "The payout failed again. It has been logged — please try again shortly." };
  }
  await logActivity({ storeId: access.store.id, role: access.role, action: "referral.payout_retried", target: referralId, metadata: { outcome } });
  revalidatePath(`/store/${slug}/admin/referrals`);
  switch (outcome) {
    case "PAID":
      return { success: true, data: { message: "Reward paid." } };
    case "NO_QUALIFYING_ORDER":
      return { success: false, error: "This customer has no completed order that meets the minimum yet." };
    case "HELD":
      return { success: false, error: "Not paid yet — see the note on this referral for what it's waiting on." };
    default:
      return { success: false, error: "Nothing to pay for this referral." };
  }
}
