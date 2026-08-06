"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { SETTING_KEYS } from "@/lib/constants/site-settings";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";

async function assertPlatformAdmin() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminToken(token);
  if (!valid) return { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
  return { success: true as const, userId: null as string | null };
}

export type MaintenanceValue = { enabled: boolean; message: string };
export type AnnouncementValue = { enabled: boolean; message: string; tone: "info" | "warning" | "success" };
export type ActiveGateway = "PAYSTACK" | "FLUTTERWAVE";

const DEFAULT_MAINTENANCE: MaintenanceValue = { enabled: false, message: "" };
const DEFAULT_ANNOUNCEMENT: AnnouncementValue = { enabled: false, message: "", tone: "info" };

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

export async function getMaintenanceSetting(): Promise<MaintenanceValue> {
  return getSetting(SETTING_KEYS.MAINTENANCE, DEFAULT_MAINTENANCE);
}

export async function getAnnouncementSetting(): Promise<AnnouncementValue> {
  return getSetting(SETTING_KEYS.ANNOUNCEMENT, DEFAULT_ANNOUNCEMENT);
}

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

// --- Admin writes ---

export async function updateMaintenanceSetting(value: MaintenanceValue): Promise<ActionResult> {
  const access = await assertPlatformAdmin();
  if (!access.success) return { success: false, error: access.error };

  await setSetting(SETTING_KEYS.MAINTENANCE, value);
  await prisma.auditLog.create({
    data: { userId: access.userId, action: "SITE_MAINTENANCE_UPDATED", entity: "PlatformSetting", entityId: SETTING_KEYS.MAINTENANCE, metadata: value },
  });

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

  revalidatePath("/", "layout");
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
