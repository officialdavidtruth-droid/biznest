import "server-only";
import { prisma } from "@/lib/prisma";

export const VENDOR_REFERRAL_SETTING_KEY = "VENDOR_REFERRAL_CONFIG";

export type VendorReferralPlanRule = { reward: number; unlockCount: number };
export type VendorReferralConfig = {
  enabled: boolean;
  /** Days a reward stays pending after the referred person pays, in case of a refund or chargeback. */
  holdDays: number;
  /** A single withdrawal above this amount waits for SupaAdmin approval. */
  reviewAbove: number;
  /** Per-plan overrides keyed by Subscription.id. Plans without one use the price bands below. */
  plans: Record<string, VendorReferralPlanRule>;
};

export const DEFAULT_VENDOR_REFERRAL_CONFIG: VendorReferralConfig = { enabled: true, holdDays: 14, reviewAbove: 100000, plans: {} };

/**
 * Default rule by what the plan costs: Starters (₦10,000) earns ₦2,000 and needs 5 paying referrals,
 * Entrepreneurship (₦45,000) earns ₦5,000 and needs 2, Business Mogul (₦139,000) earns ₦10,000 and needs 3.
 * Free (₦0) plans earn nothing.
 */
export function defaultRuleForPrice(price: number): VendorReferralPlanRule | null {
  if (!(price > 0)) return null;
  if (price <= 15000) return { reward: 2000, unlockCount: 5 };
  if (price <= 80000) return { reward: 5000, unlockCount: 2 };
  return { reward: 10000, unlockCount: 3 };
}

export function ruleForPlan(plan: { id: string; price: unknown }, config: VendorReferralConfig): VendorReferralPlanRule | null {
  const override = config.plans[plan.id];
  if (override && override.reward >= 0 && override.unlockCount >= 1) return override;
  return defaultRuleForPrice(Number(plan.price));
}

export async function getVendorReferralConfig(): Promise<VendorReferralConfig> {
  const row = await prisma.platformSetting.findUnique({ where: { key: VENDOR_REFERRAL_SETTING_KEY } });
  const v = (row?.value ?? {}) as Partial<VendorReferralConfig>;
  return {
    enabled: v.enabled ?? DEFAULT_VENDOR_REFERRAL_CONFIG.enabled,
    holdDays: Number.isFinite(v.holdDays) ? Math.min(60, Math.max(0, Number(v.holdDays))) : DEFAULT_VENDOR_REFERRAL_CONFIG.holdDays,
    reviewAbove: Number.isFinite(v.reviewAbove) ? Math.max(0, Number(v.reviewAbove)) : DEFAULT_VENDOR_REFERRAL_CONFIG.reviewAbove,
    plans: v.plans && typeof v.plans === "object" ? v.plans : {},
  };
}
