"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { attachReferral, getOrCreateReferralCode } from "@/lib/referrals/attach";
import type { ActionResult } from "@/types/actions";
import { formatNumber } from "@/lib/i18n/locale";

const MAX_REWARD_POINTS = 1_000_000;

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
  appliedCode: boolean;
  referrals: { id: string; status: "PENDING" | "REWARDED" | "CANCELLED"; points: number; createdAt: Date; friend: string }[];
};

export async function getMyReferralInfo(slug: string): Promise<MyReferralInfo | null> {
  const membership = await requireStoreCustomer(slug);
  if (!membership) return null;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, referralEnabled: true, referralReferrerPoints: true, referralRefereePoints: true },
  });
  if (!store) return null;

  const base = {
    enabled: store.referralEnabled,
    referrerPoints: store.referralReferrerPoints,
    refereePoints: store.referralRefereePoints,
  };
  if (!store.referralEnabled) return { ...base, code: null, referrals: [], appliedCode: false };

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
  input: { enabled: boolean; referrerPoints: number; refereePoints: number }
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

  await prisma.store.update({
    where: { id: access.store.id },
    data: { referralEnabled: input.enabled, referralReferrerPoints: referrerPoints, referralRefereePoints: refereePoints },
  });
  revalidatePath(`/store/${slug}/admin/referrals`);
  return { success: true, data: undefined };
}
