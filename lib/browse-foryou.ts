/**
 * "For you" ranking, pure so it can be tested. Each post is scored on how popular and fresh it is,
 * then boosted by how well it matches what this viewer has watched, liked, saved and searched.
 */
export type Interests = {
  stores: Map<string, number>;
  categories: Map<string, number>;
  tags: Map<string, number>;
};

export const EMPTY_INTERESTS = (): Interests => ({ stores: new Map(), categories: new Map(), tags: new Map() });

/** Signal strengths. Buying intent counts most; a quiet view counts least. */
export const INTEREST_WEIGHT = { VIEW: 1, VIDEO_VIEW: 2, LIKE: 3, COMMENT: 4, SAVE: 5, FOLLOW: 6, SHOP_TAP: 6, TAG_SEARCH: 3, CATEGORY: 2 } as const;

export const HALF_LIFE_DAYS = 14;
export const MAX_WEIGHT = 60;

/** A stored weight, decayed for the time since it was last touched. */
export function decayed(weight: number, updatedAt: Date, now: Date = new Date()): number {
  const days = Math.max(0, (now.getTime() - updatedAt.getTime()) / 86_400_000);
  return weight * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

export type ForYouInput = {
  id: string;
  storeId: string;
  category: string | null;
  hashtags: string[];
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  saveCount?: number;
  shopTapCount?: number;
  openReports?: number;
  verified?: boolean;
};

/** 0 to 1 deterministic wobble per post and hour, so the feed isn't identical every refresh. */
function wobble(id: string, now: Date): number {
  let h = 2166136261;
  const s = `${id}:${Math.floor(now.getTime() / 3_600_000)}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

export function affinity(p: ForYouInput, i: Interests): number {
  const store = i.stores.get(p.storeId) ?? 0;
  const cat = p.category ? (i.categories.get(p.category) ?? 0) : 0;
  const tags = p.hashtags.map((t) => i.tags.get(t) ?? 0).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  return store + 0.6 * cat + 0.4 * tags;
}

export function forYouScore(p: ForYouInput, i: Interests, now: Date = new Date()): number {
  const ageH = Math.max(0, (now.getTime() - p.createdAt.getTime()) / 3_600_000);
  const engagement = Math.log1p(p.likeCount + 2 * p.commentCount + 3 * (p.saveCount ?? 0) + 4 * (p.shopTapCount ?? 0)) + 1;
  const fresh = 1 / Math.pow(1 + ageH / 24, 0.9);
  const trust = (p.verified ? 1.1 : 1) / (1 + 2 * (p.openReports ?? 0));
  // 1x with nothing known about the viewer, up to 3.5x for a strong match.
  const boost = 1 + 2.5 * (1 - Math.exp(-affinity(p, i) / 6));
  const wob = 0.9 + 0.2 * wobble(p.id, now);
  return engagement * fresh * trust * boost * wob;
}
