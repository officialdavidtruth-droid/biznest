"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getViewer } from "@/lib/browse-viewer";
import { REPORT_REASONS, type ReportReason } from "@/lib/browse";
import { AD_FREQ_WINDOW_MS, AD_REPORT_PAUSE_AT, isAdLive, overFrequencyCap } from "@/lib/ads";
import { loadLiveAds, type AdPublic } from "@/lib/ads-data";
import type { ActionResult } from "@/types/actions";

async function ip() {
  return getClientIp(await headers());
}

const NOOP: ActionResult = { success: true, data: undefined };

/** Sponsored items for the next page of the feed. */
export async function loadMoreFeedAds(count: number): Promise<ActionResult<AdPublic[]>> {
  const viewer = await getViewer();
  return { success: true, data: await loadLiveAds("FEED", viewer?.key, Math.min(Math.max(Math.floor(count) || 0, 0), 3)) };
}

/**
 * Count one impression. Billed server-side so the browser can't inflate or skip it:
 * live + in budget + under this viewer's frequency cap, and never for the advertiser looking at their own ad.
 */
export async function recordAdImpression(adId: string): Promise<ActionResult> {
  const viewer = await getViewer({ create: true });
  if (!viewer) return NOOP;
  const rl = await checkRateLimit(`ad-impression:${await ip()}`, 400, 3_600_000);
  if (!rl.allowed) return NOOP;

  const now = new Date();
  const ad = await prisma.adCampaign.findFirst({
    where: { id: adId, status: "ACTIVE", store: { status: "ACTIVE" } },
    select: { id: true, status: true, impressions: true, impressionsBought: true, startsAt: true, endsAt: true, store: { select: { business: { select: { user: { select: { id: true } } } } } } },
  });
  if (!ad || !isAdLive(ad, now)) return NOOP;
  if (viewer.userId && ad.store.business?.user?.id === viewer.userId) return NOOP;

  const row = await prisma.adViewer.findUnique({ where: { campaignId_viewerKey: { campaignId: ad.id, viewerKey: viewer.key } } });
  if (overFrequencyCap(row, now)) return NOOP;

  const stale = !row || now.getTime() - row.windowStart.getTime() >= AD_FREQ_WINDOW_MS;
  await prisma.adViewer.upsert({
    where: { campaignId_viewerKey: { campaignId: ad.id, viewerKey: viewer.key } },
    create: { campaignId: ad.id, viewerKey: viewer.key, seen: 1, windowStart: now },
    update: stale ? { seen: 1, windowStart: now } : { seen: { increment: 1 } },
  });

  // Atomic: only counts while impressions are below what was bought.
  const bumped = await prisma.adCampaign.updateMany({ where: { id: ad.id, status: "ACTIVE", impressions: { lt: ad.impressionsBought } }, data: { impressions: { increment: 1 } } });
  if (bumped.count === 1 && ad.impressions + 1 >= ad.impressionsBought) {
    await prisma.adCampaign.updateMany({ where: { id: ad.id, status: "ACTIVE" }, data: { status: "COMPLETED" } });
    revalidatePath("/browse");
  }
  return NOOP;
}

/** Count a tap on the call-to-action. Not billed; the advertiser's own taps and obvious floods are ignored. */
export async function recordAdClick(adId: string): Promise<ActionResult> {
  const viewer = await getViewer({ create: true });
  if (!viewer) return NOOP;
  const rl = await checkRateLimit(`ad-click:${viewer.key}`, 30, 3_600_000);
  if (!rl.allowed) return NOOP;
  const ad = await prisma.adCampaign.findFirst({ where: { id: adId, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { id: true, store: { select: { business: { select: { user: { select: { id: true } } } } } } } });
  if (!ad) return NOOP;
  if (viewer.userId && ad.store.business?.user?.id === viewer.userId) return NOOP;
  await prisma.adCampaign.update({ where: { id: ad.id }, data: { clicks: { increment: 1 } } });
  return NOOP;
}

export async function reportAd(adId: string, reason: string): Promise<ActionResult> {
  const viewer = await getViewer({ create: true });
  if (!viewer) return { success: false, error: "Could not identify your browser." };
  if (!REPORT_REASONS.includes(reason as ReportReason)) return { success: false, error: "Choose a reason." };
  const rl = await checkRateLimit(`ad-report:${await ip()}`, 20, 3_600_000);
  if (!rl.allowed) return { success: false, error: "Too many reports. Try again later." };
  const ad = await prisma.adCampaign.findFirst({ where: { id: adId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { id: true } });
  if (!ad) return { success: false, error: "This ad is no longer available." };
  try {
    await prisma.adReport.create({ data: { campaignId: ad.id, viewerKey: viewer.key, reason } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NOOP;
    throw e;
  }
  const n = await prisma.adReport.count({ where: { campaignId: ad.id } });
  if (n >= AD_REPORT_PAUSE_AT) {
    await prisma.adCampaign.updateMany({ where: { id: ad.id, status: "ACTIVE" }, data: { status: "PAUSED", pausedBy: "REPORTS" } });
    revalidatePath("/browse");
  }
  return NOOP;
}
