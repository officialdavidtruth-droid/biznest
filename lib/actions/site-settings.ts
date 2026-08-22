"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { SETTING_KEYS } from "@/lib/constants/site-settings";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";

async function assertPlatformAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminToken(token);
  if (!valid) return { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
  return { success: true as const, userId: null as string | null };
}

export type MaintenanceValue = { enabled: boolean; message: string };
export type AnnouncementValue = { enabled: boolean; message: string; tone: "info" | "warning" | "success" };
export type ActiveGateway = "PAYSTACK" | "FLUTTERWAVE";
// pointsPerNaira: how many points a customer earns per ₦1 spent (order total).
// nairaPerPoint: how many naira one point is worth when cashed out as a coupon.
export type LoyaltyRates = { pointsPerNaira: number; nairaPerPoint: number };
// enabled: whether the self-serve trial applies at all. planId: which
// Subscription gets it (null = not yet configured / disabled). days: trial
// length. SupaAdmin-controlled so this never needs a code change to tune —
// see lib/actions/subscription.ts's initiatePlanUpgrade, the only reader.
export type FreeTrialValue = { enabled: boolean; planId: string | null; days: number };

const DEFAULT_MAINTENANCE: MaintenanceValue = { enabled: false, message: "" };
const DEFAULT_ANNOUNCEMENT: AnnouncementValue = { enabled: false, message: "", tone: "info" };
// Default: ₦100 spent -> 1 point, 1 point cashed out -> ₦1 coupon value.
// Deliberately conservative; platform admin can tune both independently
// from supaadmin once the loyalty settings UI exists.
const DEFAULT_LOYALTY_RATES: LoyaltyRates = { pointsPerNaira: 0.01, nairaPerPoint: 1 };
const DEFAULT_FREE_TRIAL: FreeTrialValue = { enabled: false, planId: null, days: 14 };

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return row.value as T;
}

async function setSetting(key: string, value: unknown) {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value as any },
    update: { value: value as any },
  });
}

// --- Public reads (no auth needed — root layout, checkout, etc. call these) ---
//
// These two run on EVERY page load via the root layout, so they're wrapped
// in unstable_cache instead of hitting Postgres per-request. Cache is
// invalidated by tag whenever an admin updates either setting (see
// updateMaintenanceSetting / updateAnnouncementSetting below), so this never
// serves stale data after a real change — it just skips the DB round-trip
// for the (extremely common) case where nothing changed.

export const getMaintenanceSetting = unstable_cache(
  async (): Promise<MaintenanceValue> => getSetting(SETTING_KEYS.MAINTENANCE, DEFAULT_MAINTENANCE),
  ["site-setting-maintenance"],
  { tags: ["site-settings"], revalidate: 60 }
);

export const getAnnouncementSetting = unstable_cache(
  async (): Promise<AnnouncementValue> => getSetting(SETTING_KEYS.ANNOUNCEMENT, DEFAULT_ANNOUNCEMENT),
  ["site-setting-announcement"],
  { tags: ["site-settings"], revalidate: 60 }
);

/**
 * Which gateway checkout/subscription-upgrade should use right now.
 * Falls back to whichever gateway actually has secret keys configured if no
 * explicit choice has been made yet, so a fresh install isn't broken.
 */
export async function getActiveGateway(): Promise<ActiveGateway> {
  const stored = await getSetting<ActiveGateway | null>(SETTING_KEYS.ACTIVE_GATEWAY, null);
  if (stored === "PAYSTACK" || stored === "FLUTTERWAVE") return stored;
  if (process.env.FLUTTERWAVE_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY) return "FLUTTERWAVE";
  return "PAYSTACK";
}

export async function getGatewayAvailability() {
  return {
    paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
    flutterwaveConfigured: Boolean(process.env.FLUTTERWAVE_SECRET_KEY),
    active: await getActiveGateway(),
  };
}

/**
 * Single global loyalty rate for the whole platform (per product decision —
 * no per-merchant override). lib/actions/loyalty.ts is the only other
 * caller; kept here alongside the other platform-wide settings rather than
 * in loyalty.ts so every PlatformSetting read/write goes through one file.
 */
export async function getLoyaltyRates(): Promise<LoyaltyRates> {
  return getSetting(SETTING_KEYS.LOYALTY_RATES, DEFAULT_LOYALTY_RATES);
}

// Read by lib/actions/subscription.ts on every plan-upgrade attempt, so
// this is NOT wrapped in unstable_cache like maintenance/announcement —
// billing logic should never act on a stale cached value.
export async function getFreeTrialSetting(): Promise<FreeTrialValue> {
  return getSetting(SETTING_KEYS.FREE_TRIAL, DEFAULT_FREE_TRIAL);
}

// --- Admin writes ---

export async function updateLoyaltyRates(value: LoyaltyRates): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };

  if (value.pointsPerNaira <= 0 || value.nairaPerPoint <= 0) {
    return { success: false, error: "Loyalty rates must be greater than zero." };
  }

  await setSetting(SETTING_KEYS.LOYALTY_RATES, value);
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "LOYALTY_RATES_UPDATED", entity: "PlatformSetting", entityId: SETTING_KEYS.LOYALTY_RATES, metadata: value },
  });

  return { success: true, data: undefined };
}

export async function updateMaintenanceSetting(value: MaintenanceValue): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };

  await setSetting(SETTING_KEYS.MAINTENANCE, value);
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "SITE_MAINTENANCE_UPDATED", entity: "PlatformSetting", entityId: SETTING_KEYS.MAINTENANCE, metadata: value },
  });

  revalidateTag("site-settings");
  revalidatePath("/", "layout");
  revalidatePath("/supaadmin/settings");
  return { success: true, data: undefined };
}

export async function updateAnnouncementSetting(value: AnnouncementValue): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };

  await setSetting(SETTING_KEYS.ANNOUNCEMENT, value);
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "SITE_ANNOUNCEMENT_UPDATED", entity: "PlatformSetting", entityId: SETTING_KEYS.ANNOUNCEMENT, metadata: value },
  });

  revalidateTag("site-settings");
  revalidatePath("/", "layout");
  revalidatePath("/supaadmin/settings");
  return { success: true, data: undefined };
}

export async function updateFreeTrialSetting(value: FreeTrialValue): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };

  if (value.enabled) {
    if (!value.planId) return { success: false, error: "Choose which plan the trial applies to." };
    if (!Number.isInteger(value.days) || value.days < 1 || value.days > 365) {
      return { success: false, error: "Trial length must be between 1 and 365 days." };
    }
    const plan = await prisma.subscription.findUnique({ where: { id: value.planId } });
    if (!plan) return { success: false, error: "That plan no longer exists." };
    if (Number(plan.price) === 0) return { success: false, error: "The free plan doesn't need a trial." };
  }

  await setSetting(SETTING_KEYS.FREE_TRIAL, value);
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "FREE_TRIAL_SETTING_UPDATED", entity: "PlatformSetting", entityId: SETTING_KEYS.FREE_TRIAL, metadata: value },
  });

  revalidatePath("/supaadmin/settings");
  return { success: true, data: undefined };
}

export async function setActiveGateway(gateway: ActiveGateway): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };

  const availability = await getGatewayAvailability();
  const configured = gateway === "PAYSTACK" ? availability.paystackConfigured : availability.flutterwaveConfigured;
  if (!configured) {
    return { success: false, error: `Add ${gateway === "PAYSTACK" ? "PAYSTACK_SECRET_KEY" : "FLUTTERWAVE_SECRET_KEY"} to your environment variables before activating it.` };
  }

  await setSetting(SETTING_KEYS.ACTIVE_GATEWAY, gateway);
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "PAYMENT_GATEWAY_CHANGED", entity: "PlatformSetting", entityId: SETTING_KEYS.ACTIVE_GATEWAY, metadata: { gateway } },
  });

  revalidatePath("/supaadmin/settings");
  return { success: true, data: undefined };
}
