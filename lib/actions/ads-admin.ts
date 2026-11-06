"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { notifyUser } from "@/lib/notifications/notify";
import { AD_STATUS_LABEL, spentNaira, type AdStatus } from "@/lib/ads";
import type { ActionResult } from "@/types/actions";

async function assertPlatformStaff() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return (await verifyAdminSession(token)) ? { success: true as const } : { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
}

export type AdminAdRow = {
  id: string; storeName: string; storeSlug: string; placement: string; status: AdStatus; statusLabel: string; pausedBy: string | null;
  caption: string | null; imageUrl: string | null; budget: number; spent: number; impressions: number; clicks: number; reports: number; endsAt: string | null; createdAt: string;
};

export async function listAdCampaigns(filter: "ALL" | "REPORTED" | "ACTIVE" = "ALL"): Promise<AdminAdRow[]> {
  const g = await assertPlatformStaff();
  if (!g.success) return [];
  const rows = await prisma.adCampaign.findMany({
    where: { status: { not: "PENDING_PAYMENT" }, ...(filter === "ACTIVE" ? { status: "ACTIVE" } : {}), ...(filter === "REPORTED" ? { reports: { some: {} } } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    include: { store: { select: { name: true, slug: true } }, _count: { select: { reports: true } } },
  });
  return rows.map((c) => {
    const budget = Number(c.budget);
    return {
      id: c.id, storeName: c.store.name, storeSlug: c.store.slug, placement: c.placement, status: c.status as AdStatus, statusLabel: AD_STATUS_LABEL[c.status as AdStatus] ?? c.status, pausedBy: c.pausedBy,
      caption: c.caption, imageUrl: c.imageUrl, budget, spent: spentNaira(c.impressions, Number(c.rateNaira), budget), impressions: c.impressions, clicks: c.clicks, reports: c._count.reports,
      endsAt: c.endsAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(),
    };
  });
}

/** pause / resume / remove. A removed ad stops for good; its unspent budget is refunded by hand from the gateway dashboard. */
export async function moderateAd(campaignId: string, action: "PAUSE" | "RESUME" | "REMOVE"): Promise<ActionResult> {
  const g = await assertPlatformStaff();
  if (!g.success) return { success: false, error: g.error };
  const c = await prisma.adCampaign.findUnique({ where: { id: campaignId }, select: { id: true, status: true, store: { select: { slug: true, business: { select: { user: { select: { id: true } } } } } } } });
  if (!c) return { success: false, error: "Campaign not found." };
  if (c.status === "REMOVED" || c.status === "PENDING_PAYMENT") return { success: false, error: "That campaign can't be changed." };

  const data = action === "PAUSE" ? { status: "PAUSED", pausedBy: "ADMIN" } : action === "RESUME" ? { status: "ACTIVE", pausedBy: null } : { status: "REMOVED", pausedBy: "ADMIN" };
  if (action === "PAUSE" && c.status !== "ACTIVE") return { success: false, error: "Only running ads can be paused." };
  if (action === "RESUME" && c.status !== "PAUSED") return { success: false, error: "Only paused ads can be resumed." };
  await prisma.adCampaign.update({ where: { id: c.id }, data });
  await prisma.auditLog.create({ data: { action: `AD_${action}`, entity: "AdCampaign", entityId: c.id, metadata: { by: "platform-admin" } } }).catch(() => undefined);
  const owner = c.store.business?.user?.id;
  if (owner && action !== "RESUME") {
    await notifyUser({ userId: owner, type: "AD_MODERATED", title: action === "REMOVE" ? "An ad was removed" : "An ad was paused", body: "BizNest reviewed one of your Browse ads. Contact support if you think this was a mistake.", url: `/store/${c.store.slug}/admin/ads` }).catch(() => undefined);
  }
  revalidatePath("/supaadmin/ads");
  revalidatePath(`/store/${c.store.slug}/admin/ads`);
  revalidatePath("/browse");
  return { success: true, data: undefined };
}
