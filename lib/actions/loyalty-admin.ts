"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { getLoyaltyRates } from "@/lib/actions/site-settings";
import { getStoreLoyaltyRates } from "@/lib/loyalty-rates";
import type { ActionResult } from "@/types/actions";

async function loyaltyAccess(slug: string) {
  const a = await assertStorePermission(slug, "plugin:loyalty-rewards");
  if (!a.success) return a;
  const entitlement = await getPluginEntitlement(a.store.id, "loyalty-rewards");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install Loyalty Rewards from Apps first." };
  return a;
}

export type LoyaltyTier = "Member" | "Silver" | "Gold" | "Platinum";
/** Tiers are based on points earned over the account's lifetime, so spending points never lowers a tier. */
function tierFor(lifetimeEarned: number): LoyaltyTier {
  if (lifetimeEarned >= 5000) return "Platinum";
  if (lifetimeEarned >= 2000) return "Gold";
  if (lifetimeEarned >= 500) return "Silver";
  return "Member";
}

export type LoyaltyAccountView = {
  id: string; name: string; email: string; balance: number; lifetimeEarned: number; redeemed: number; tier: LoyaltyTier; updatedAt: string;
  entries: { id: string; type: string; points: number; note: string | null; createdAt: string }[];
};

export async function getLoyaltyAdmin(slug: string): Promise<{ error: string } | { accounts: LoyaltyAccountView[]; rates: { pointsPerNaira: number; nairaPerPoint: number; custom: boolean }; platformRates: { pointsPerNaira: number; nairaPerPoint: number }; totals: { accounts: number; outstanding: number; earned30: number; redeemed30: number; liability: number } }> {
  const a = await loyaltyAccess(slug);
  if (!a.success) return { error: a.error };
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [rows, rates] = await Promise.all([
    prisma.storeLoyaltyAccount.findMany({
      where: { storeId: a.store.id },
      orderBy: { pointsBalance: "desc" },
      take: 500,
      include: { user: { select: { name: true, email: true } }, entries: { orderBy: { createdAt: "desc" }, take: 25 } },
    }),
    getStoreLoyaltyRates(a.store.id),
  ]);
  const sums = await prisma.storeLoyaltyEntry.groupBy({ by: ["loyaltyAccountId", "type"], where: { loyaltyAccount: { storeId: a.store.id } }, _sum: { points: true } });
  const earned = new Map<string, number>(); const spent = new Map<string, number>();
  for (const s of sums) {
    const n = s._sum.points ?? 0;
    if (s.type === "EARN" || (s.type === "ADJUSTMENT" && n > 0)) earned.set(s.loyaltyAccountId, (earned.get(s.loyaltyAccountId) ?? 0) + n);
    if (s.type === "REDEEM") spent.set(s.loyaltyAccountId, (spent.get(s.loyaltyAccountId) ?? 0) + Math.abs(n));
  }
  const [e30, r30] = await Promise.all([
    prisma.storeLoyaltyEntry.aggregate({ where: { loyaltyAccount: { storeId: a.store.id }, type: "EARN", createdAt: { gte: since } }, _sum: { points: true } }),
    prisma.storeLoyaltyEntry.aggregate({ where: { loyaltyAccount: { storeId: a.store.id }, type: "REDEEM", createdAt: { gte: since } }, _sum: { points: true } }),
  ]);
  const outstanding = rows.reduce((n, r) => n + r.pointsBalance, 0);
  return {
    rates,
    platformRates: await getLoyaltyRates(),
    accounts: rows.map((r) => ({
      id: r.id, name: r.user.name || r.user.email.split("@")[0], email: r.user.email, balance: r.pointsBalance,
      lifetimeEarned: earned.get(r.id) ?? 0, redeemed: spent.get(r.id) ?? 0, tier: tierFor(earned.get(r.id) ?? 0), updatedAt: r.updatedAt.toISOString(),
      entries: r.entries.map((e) => ({ id: e.id, type: e.type, points: e.points, note: e.note, createdAt: e.createdAt.toISOString() })),
    })),
    totals: { accounts: rows.length, outstanding, earned30: e30._sum.points ?? 0, redeemed30: Math.abs(r30._sum.points ?? 0), liability: Math.round(outstanding * rates.nairaPerPoint) },
  };
}

/** Manual correction or goodwill bonus. Positive adds points, negative removes them; the balance can never go below zero. */
export async function adjustLoyaltyPoints(slug: string, accountId: string, points: number, note: string): Promise<ActionResult> {
  const a = await loyaltyAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  if (!Number.isInteger(points) || points === 0) return { success: false, error: "Enter a whole number of points, positive or negative." };
  if (Math.abs(points) > 1_000_000) return { success: false, error: "That adjustment is too large." };
  if (!note.trim()) return { success: false, error: "Add a short reason so the change can be traced." };
  const ok = await prisma.$transaction(async (tx) => {
    const acct = await tx.storeLoyaltyAccount.findFirst({ where: { id: accountId, storeId: a.store.id } });
    if (!acct) return "Account not found.";
    if (acct.pointsBalance + points < 0) return "That would take the balance below zero.";
    await tx.storeLoyaltyEntry.create({ data: { loyaltyAccountId: acct.id, type: "ADJUSTMENT", points, note: note.trim().slice(0, 200) } });
    await tx.storeLoyaltyAccount.update({ where: { id: acct.id }, data: { pointsBalance: { increment: points } } });
    return null;
  });
  if (ok) return { success: false, error: ok };
  revalidatePath(`/store/${slug}/admin/apps/loyalty-rewards`);
  return { success: true, data: undefined };
}

/**
 * Sets this store's own rates. Pass spendPerPoint (naira spent to earn one point) and pointValue
 * (naira one point is worth at cash-out), or null for either to follow the platform rate again.
 */
export async function saveLoyaltyRates(slug: string, spendPerPoint: number | null, pointValue: number | null): Promise<ActionResult> {
  const a = await loyaltyAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  if (spendPerPoint != null && !(spendPerPoint >= 1 && spendPerPoint <= 1_000_000)) return { success: false, error: "Spend per point must be between 1 and 1,000,000." };
  if (pointValue != null && !(pointValue > 0 && pointValue <= 10_000)) return { success: false, error: "Point value must be greater than 0." };
  const platform = await getLoyaltyRates();
  const earn = spendPerPoint != null ? 1 / spendPerPoint : platform.pointsPerNaira;
  const redeem = pointValue ?? platform.nairaPerPoint;
  // Each naira spent returns earn * redeem naira of coupon. At 100% or more the store pays customers to buy.
  if (earn * redeem >= 1) return { success: false, error: "These rates would give back as much as customers spend. Raise the spend per point or lower the point value." };
  await prisma.store.update({ where: { id: a.store.id }, data: { loyaltyPointsPerNaira: spendPerPoint != null ? earn : null, loyaltyNairaPerPoint: pointValue } });
  revalidatePath(`/store/${slug}/admin/apps/loyalty-rewards`);
  return { success: true, data: undefined };
}
