import { prisma } from "@/lib/prisma";
import type { StoryRing } from "@/lib/browse-data";
import { AD_CTA_LABEL, AD_FREQ_WINDOW_MS, AD_STATUS_LABEL, ctr, isAdLive, overFrequencyCap, pickAds, spentNaira, type AdCta, type AdPlacement, type AdStatus } from "@/lib/ads";

/** What a viewer needs to render a sponsored item. No budget or stats. */
export type AdPublic = {
  id: string;
  placement: AdPlacement;
  caption: string | null;
  imageUrl: string | null;
  bgColor: string | null;
  ctaLabel: string;
  product: { id: string; name: string; price: number | null; currency: string } | null;
  store: { slug: string; name: string; logoUrl: string | null; verified: boolean };
};

type AdRow = {
  id: string; placement: string; caption: string | null; imageUrl: string | null; bgColor: string | null; ctaLabel: string;
  productId: string | null; productName: string | null; productPrice: unknown; productCurrency: string | null;
  store: { slug: string; name: string; logoUrl: string | null; business: { verificationBadge: boolean } | null };
};

export function toAdPublic(r: AdRow): AdPublic {
  return {
    id: r.id, placement: r.placement === "STORY" ? "STORY" : "FEED", caption: r.caption, imageUrl: r.imageUrl, bgColor: r.bgColor, ctaLabel: r.ctaLabel,
    product: r.productId && r.productName ? { id: r.productId, name: r.productName, price: r.productPrice == null ? null : Number(r.productPrice), currency: r.productCurrency ?? "NGN" } : null,
    store: { slug: r.store.slug, name: r.store.name, logoUrl: r.store.logoUrl, verified: !!r.store.business?.verificationBadge },
  };
}

/** Ads that can be shown right now to this viewer: paid, running, in budget and in date, store active and public, under the frequency cap. */
export async function loadLiveAds(placement: AdPlacement, viewerKey: string | null | undefined, count: number): Promise<AdPublic[]> {
  if (count <= 0) return [];
  const now = new Date();
  const rows = await prisma.adCampaign.findMany({
    where: {
      status: "ACTIVE", placement, endsAt: { gt: now }, startsAt: { lte: now },
      store: { status: "ACTIVE", business: { is: { searchVisible: true } } },
    },
    orderBy: { createdAt: "asc" },
    take: 80,
    include: { store: { select: { slug: true, name: true, logoUrl: true, business: { select: { verificationBadge: true } } } } },
  });
  const inBudget = rows.filter((c) => isAdLive(c, now));
  if (inBudget.length === 0) return [];
  let eligible = inBudget;
  if (viewerKey) {
    const seen = await prisma.adViewer.findMany({ where: { viewerKey, campaignId: { in: inBudget.map((c) => c.id) } }, select: { campaignId: true, seen: true, windowStart: true } });
    const byId = new Map<string, { seen: number; windowStart: Date }>();
    for (const s of seen as Array<{ campaignId: string; seen: number; windowStart: Date }>) byId.set(s.campaignId, s);
    eligible = inBudget.filter((c) => !overFrequencyCap(byId.get(c.id), now));
  }
  return pickAds(eligible, count, now).map((c) => toAdPublic(c as unknown as AdRow));
}

export type VendorAdView = {
  id: string; placement: AdPlacement; status: AdStatus; statusLabel: string; pausedBy: string | null;
  caption: string | null; imageUrl: string | null; bgColor: string | null; ctaLabel: string; productName: string | null;
  budget: number; spent: number; impressions: number; impressionsBought: number; clicks: number; ctr: number;
  durationDays: number; startsAt: string | null; endsAt: string | null; createdAt: string; reportCount: number;
};

export async function loadVendorAds(storeId: string): Promise<VendorAdView[]> {
  await completeExpiredAds(storeId).catch(() => undefined);
  const rows = await prisma.adCampaign.findMany({
    where: { storeId, status: { not: "REMOVED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { reports: true } } },
  });
  return rows.map((c) => {
    const budget = Number(c.budget);
    return {
      id: c.id, placement: c.placement === "STORY" ? "STORY" : "FEED", status: c.status as AdStatus, statusLabel: AD_STATUS_LABEL[c.status as AdStatus] ?? c.status, pausedBy: c.pausedBy,
      caption: c.caption, imageUrl: c.imageUrl, bgColor: c.bgColor, ctaLabel: c.ctaLabel, productName: c.productName,
      budget, spent: spentNaira(c.impressions, Number(c.rateNaira), budget), impressions: c.impressions, impressionsBought: c.impressionsBought, clicks: c.clicks, ctr: ctr(c.clicks, c.impressions),
      durationDays: c.durationDays, startsAt: c.startsAt?.toISOString() ?? null, endsAt: c.endsAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(), reportCount: c._count.reports,
    };
  });
}

export const FREQ_WINDOW_MS = AD_FREQ_WINDOW_MS;

/** A sponsored story as a one-story ring so the existing viewer can play it. */
export function adToRing(ad: AdPublic): StoryRing {
  return {
    storeSlug: ad.store.slug, storeName: ad.store.name, logoUrl: ad.store.logoUrl, verified: ad.store.verified, allSeen: false, latestAt: new Date().toISOString(), sponsored: true,
    stories: [{
      id: `ad:${ad.id}`, kind: ad.imageUrl ? "IMAGE" : "TEXT", imageUrl: ad.imageUrl, text: ad.caption, bgColor: ad.bgColor, createdAt: new Date().toISOString(), seen: false,
      ad: { id: ad.id, cta: AD_CTA_LABEL[ad.ctaLabel as AdCta] ?? "Learn more" }, product: ad.product,
    }],
  };
}

/** Flip campaigns whose run has ended to COMPLETED so dashboards show the truth. */
export async function completeExpiredAds(storeId?: string) {
  await prisma.adCampaign.updateMany({ where: { status: "ACTIVE", endsAt: { lte: new Date() }, ...(storeId ? { storeId } : {}) }, data: { status: "COMPLETED" } });
}
