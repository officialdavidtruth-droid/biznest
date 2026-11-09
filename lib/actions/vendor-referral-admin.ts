"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { approveVendorReferralWithdrawal, rejectVendorReferralWithdrawal } from "@/lib/referrals/vendor-referral";
import { VENDOR_REFERRAL_SETTING_KEY, type VendorReferralConfig } from "@/lib/referrals/vendor-config";

async function isAdmin() {
  return verifyAdminSession((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
}
const DENIED = { success: false as const, error: "Admin session expired. Sign in again." };

export async function approveReferralWithdrawal(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return DENIED;
  const ok = await approveVendorReferralWithdrawal(id);
  if (!ok) return { success: false, error: "That withdrawal is no longer waiting for review." };
  await prisma.auditLog.create({ data: { userId: null, action: "REFERRAL_WITHDRAWAL_APPROVED", entity: "VendorReferralWithdrawal", entityId: id } });
  revalidatePath("/supaadmin/referrals");
  return { success: true, data: undefined };
}

export async function rejectReferralWithdrawal(id: string, reason: string): Promise<ActionResult> {
  if (!(await isAdmin())) return DENIED;
  const ok = await rejectVendorReferralWithdrawal(id, reason.trim().slice(0, 200) || "Rejected by admin");
  if (!ok) return { success: false, error: "That withdrawal is no longer waiting for review." };
  await prisma.auditLog.create({ data: { userId: null, action: "REFERRAL_WITHDRAWAL_REJECTED", entity: "VendorReferralWithdrawal", entityId: id, metadata: { reason } } });
  revalidatePath("/supaadmin/referrals");
  return { success: true, data: undefined };
}

/** Cancels a reward that is still pending or sitting in the wallet (fraud, abuse). Already-withdrawn rewards can't be cancelled. */
export async function cancelReferralReward(id: string, reason: string): Promise<ActionResult> {
  if (!(await isAdmin())) return DENIED;
  const r = await prisma.vendorReferral.updateMany({
    where: { id, status: { in: ["SIGNED_UP", "PENDING", "CONFIRMED"] }, withdrawalId: null },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.trim().slice(0, 200) || "Cancelled by admin" },
  });
  if (r.count === 0) return { success: false, error: "That reward can't be cancelled (already withdrawn or cancelled)." };
  await prisma.auditLog.create({ data: { userId: null, action: "REFERRAL_REWARD_CANCELLED", entity: "VendorReferral", entityId: id, metadata: { reason } } });
  revalidatePath("/supaadmin/referrals");
  return { success: true, data: undefined };
}

export async function saveReferralConfig(input: { enabled: boolean; holdDays: number; reviewAbove: number; plans: Record<string, { reward: number; unlockCount: number }> }): Promise<ActionResult> {
  if (!(await isAdmin())) return DENIED;
  const plans: VendorReferralConfig["plans"] = {};
  for (const [id, rule] of Object.entries(input.plans)) {
    const reward = Math.round(Number(rule.reward));
    const unlockCount = Math.round(Number(rule.unlockCount));
    if (!(reward >= 0) || reward > 1000000) return { success: false, error: "Rewards must be between ₦0 and ₦1,000,000." };
    if (!(unlockCount >= 1) || unlockCount > 100) return { success: false, error: "Referrals needed must be between 1 and 100." };
    plans[id] = { reward, unlockCount };
  }
  const value: VendorReferralConfig = {
    enabled: !!input.enabled,
    holdDays: Math.min(60, Math.max(0, Math.round(Number(input.holdDays) || 0))),
    reviewAbove: Math.max(0, Math.round(Number(input.reviewAbove) || 0)),
    plans,
  };
  await prisma.platformSetting.upsert({ where: { key: VENDOR_REFERRAL_SETTING_KEY }, create: { key: VENDOR_REFERRAL_SETTING_KEY, value }, update: { value } });
  await prisma.auditLog.create({ data: { userId: null, action: "REFERRAL_CONFIG_UPDATED", entity: "PlatformSetting", entityId: VENDOR_REFERRAL_SETTING_KEY, metadata: value } });
  revalidatePath("/supaadmin/referrals");
  return { success: true, data: undefined };
}
