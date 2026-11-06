/** Pure helpers for Browse ads: pricing, validation, references, eligibility and feed placement. */
import { containsLink, safeHttpsImage, STORY_BG_COLORS, STORY_TEXT_MAX, BROWSE_CAPTION_MAX } from "@/lib/browse";

export type AdPlacement = "FEED" | "STORY";
export const AD_PLACEMENTS: readonly AdPlacement[] = ["FEED", "STORY"];
export const AD_PLACEMENT_LABEL: Record<AdPlacement, string> = { FEED: "In the feed", STORY: "In the story row" };

/** Price per 1,000 impressions in naira. One place to change when pricing is revisited. */
export const AD_RATE_PER_1000: Record<AdPlacement, number> = { FEED: 1500, STORY: 2000 };
export const AD_MIN_BUDGET = 2000;
export const AD_MAX_BUDGET = 500_000;
export const AD_DURATIONS = [3, 7, 14, 30] as const;
/** A single viewer sees one campaign at most this many times per 24 hours. */
export const AD_FREQ_CAP = 3;
export const AD_FREQ_WINDOW_MS = 24 * 3_600_000;
/** One sponsored post after every N organic posts. */
export const AD_FEED_EVERY = 5;
/** Distinct reporters that pause a campaign until staff decide. */
export const AD_REPORT_PAUSE_AT = 3;
export const AD_MAX_ACTIVE_PER_STORE = 5;

export const AD_CTAS = ["SHOP_NOW", "LEARN_MORE", "ORDER_NOW", "BOOK_NOW", "VISIT_STORE"] as const;
export type AdCta = (typeof AD_CTAS)[number];
export const AD_CTA_LABEL: Record<AdCta, string> = { SHOP_NOW: "Shop now", LEARN_MORE: "Learn more", ORDER_NOW: "Order now", BOOK_NOW: "Book now", VISIT_STORE: "Visit store" };

export type AdStatus = "PENDING_PAYMENT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "REMOVED";
export const AD_STATUS_LABEL: Record<AdStatus, string> = { PENDING_PAYMENT: "Awaiting payment", ACTIVE: "Running", PAUSED: "Paused", COMPLETED: "Finished", REMOVED: "Removed" };

export const AD_REF_PREFIX = "ADS-";
const NONCE_LEN = 8;

export const adRate = (placement: AdPlacement) => AD_RATE_PER_1000[placement];

/** Impressions a budget buys at the given rate per 1,000. */
export function impressionsFor(budgetNaira: number, rate: number): number {
  if (!(budgetNaira > 0) || !(rate > 0)) return 0;
  return Math.floor((budgetNaira / rate) * 1000);
}

/** Naira spent so far, rounded to kobo and never above the budget. */
export function spentNaira(impressions: number, rate: number, budget: number): number {
  return Math.min(budget, Math.round((impressions / 1000) * rate * 100) / 100);
}

export const ctr = (clicks: number, impressions: number) => (impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0);

// -------------------------------------------------------------- references

/** ADS-<campaignId>-<8 char nonce>. Campaign ids are cuids (no "-"), but nonces can contain "-", so never split on it. */
export const adReference = (campaignId: string, nonce: string) => `${AD_REF_PREFIX}${campaignId}-${nonce}`;

export function parseAdReference(reference: string): { campaignId: string } | null {
  if (!reference.startsWith(AD_REF_PREFIX)) return null;
  const body = reference.slice(AD_REF_PREFIX.length);
  if (body.length <= NONCE_LEN + 1 || body[body.length - NONCE_LEN - 1] !== "-") return null;
  const campaignId = body.slice(0, body.length - NONCE_LEN - 1);
  return campaignId ? { campaignId } : null;
}

// -------------------------------------------------------------- validation

export type AdInput = {
  placement?: unknown; caption?: unknown; imageUrl?: unknown; bgColor?: unknown; ctaLabel?: unknown; budget?: unknown; durationDays?: unknown;
};
export type CleanAd = {
  placement: AdPlacement; caption: string | null; imageUrl: string | null; bgColor: string | null; ctaLabel: AdCta; budget: number; durationDays: number; rate: number; impressions: number;
};

export function sanitizeAd(input: AdInput): { ok: true; ad: CleanAd } | { ok: false; error: string } {
  const placement = AD_PLACEMENTS.find((p) => p === input.placement);
  if (!placement) return { ok: false, error: "Choose where the ad should appear." };

  const max = placement === "STORY" ? STORY_TEXT_MAX : BROWSE_CAPTION_MAX;
  const caption = typeof input.caption === "string" ? input.caption.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "";
  const imageUrl = input.imageUrl ? safeHttpsImage(input.imageUrl) : null;
  if (input.imageUrl && !imageUrl) return { ok: false, error: "That photo link isn't valid." };
  if (!imageUrl && !caption) return { ok: false, error: "Add a photo or some text for the ad." };
  if (placement === "FEED" && !imageUrl) return { ok: false, error: "Feed ads need a photo." };
  if (caption && containsLink(caption)) return { ok: false, error: "Ads can't contain links. People are sent to your store when they tap." };

  const bgColor = !imageUrl ? ((STORY_BG_COLORS as readonly string[]).includes(String(input.bgColor)) ? String(input.bgColor) : STORY_BG_COLORS[0]) : null;
  const ctaLabel = AD_CTAS.find((c) => c === input.ctaLabel) ?? "SHOP_NOW";

  const budget = Math.round(Number(input.budget) * 100) / 100;
  if (!Number.isFinite(budget) || budget < AD_MIN_BUDGET) return { ok: false, error: `The minimum budget is ₦${AD_MIN_BUDGET.toLocaleString("en-NG")}.` };
  if (budget > AD_MAX_BUDGET) return { ok: false, error: `The maximum budget is ₦${AD_MAX_BUDGET.toLocaleString("en-NG")} per campaign.` };
  const durationDays = AD_DURATIONS.find((d) => d === Number(input.durationDays));
  if (!durationDays) return { ok: false, error: "Choose how long the ad should run." };

  const rate = adRate(placement);
  return { ok: true, ad: { placement, caption: caption || null, imageUrl, bgColor, ctaLabel, budget, durationDays, rate, impressions: impressionsFor(budget, rate) } };
}

// ------------------------------------------------------------- eligibility

export type LiveCheck = { status: string; impressions: number; impressionsBought: number; endsAt: Date | null; startsAt?: Date | null };

export function isAdLive(c: LiveCheck, now = new Date()): boolean {
  return c.status === "ACTIVE" && c.impressions < c.impressionsBought && !!c.endsAt && c.endsAt.getTime() > now.getTime() && (!c.startsAt || c.startsAt.getTime() <= now.getTime());
}

/** Has this viewer used up their allowance for the campaign in the current window? */
export function overFrequencyCap(row: { seen: number; windowStart: Date } | null | undefined, now = new Date()): boolean {
  if (!row) return false;
  if (now.getTime() - row.windowStart.getTime() >= AD_FREQ_WINDOW_MS) return false;
  return row.seen >= AD_FREQ_CAP;
}

/** Spread delivery: campaigns with the most budget left relative to time left go first, ties broken randomly. */
export function pickAds<T extends { impressions: number; impressionsBought: number; endsAt: Date | null }>(pool: T[], count: number, now = new Date(), rand: () => number = Math.random): T[] {
  const scored = pool.map((c) => {
    const left = c.impressionsBought - c.impressions;
    const hours = Math.max(1, ((c.endsAt?.getTime() ?? now.getTime()) - now.getTime()) / 3_600_000);
    return { c, score: left / hours + rand() * 0.001 };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, Math.max(0, count)).map((x) => x.c);
}

// ----------------------------------------------------------------- feed

export type FeedItem<P, A> = { type: "post"; post: P } | { type: "ad"; ad: A };

/**
 * Interleaves sponsored items into the posts: one after every `every` organic posts.
 * `offset` is how many organic posts came before this page, so load-more keeps the rhythm.
 */
export function injectAds<P, A>(posts: P[], ads: A[], every = AD_FEED_EVERY, offset = 0): FeedItem<P, A>[] {
  const out: FeedItem<P, A>[] = [];
  let a = 0;
  posts.forEach((post, i) => {
    out.push({ type: "post", post });
    if ((offset + i + 1) % every === 0 && a < ads.length) out.push({ type: "ad", ad: ads[a++] });
  });
  return out;
}

/** Story-row placement: a sponsored ring goes in the second slot, then every fourth one after. */
export function injectRingAds<R, A>(rings: R[], ads: A[]): Array<{ ring?: R; ad?: A }> {
  const out: Array<{ ring?: R; ad?: A }> = [];
  let a = 0;
  rings.forEach((ring, i) => {
    out.push({ ring });
    if ((i === 0 || (i - 1) % 4 === 3) && a < ads.length) out.push({ ad: ads[a++] });
  });
  if (rings.length === 0) ads.forEach((ad) => out.push({ ad }));
  return out;
}
