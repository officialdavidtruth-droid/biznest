/** Pure helpers for the Browse feed: validation, cursors, viewer keys, ranking, relative time. */

export const BROWSE_MAX_IMAGES = 4;
export const BROWSE_CAPTION_MAX = 600;
export const BROWSE_COMMENT_MAX = 300;
export const BROWSE_NAME_MAX = 40;
export const BROWSE_DAILY_POST_LIMIT = 10;
/** Distinct reports that hide a post/comment until BizNest staff decide. */
export const BROWSE_REPORT_HIDE_AT = 3;
export const BROWSE_PAGE_SIZE = 8;
export const REPORT_REASONS = ["SPAM", "SCAM", "OFFENSIVE", "ILLEGAL", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABEL: Record<ReportReason, string> = { SPAM: "Spam", SCAM: "Scam or fake", OFFENSIVE: "Offensive", ILLEGAL: "Illegal item", OTHER: "Something else" };

/** Returned by toggleFollowStore when nobody is signed in; the client turns it into a "Create account" prompt. */
export const FOLLOW_NEEDS_ACCOUNT = "Create a free account to follow businesses.";

/** Returned by like and comment actions when nobody is signed in. */
export const INTERACT_NEEDS_ACCOUNT = "Create a free account to like and comment.";

/** BizNest's own Browse account. It is a real (store-less) store row so posts, stories, follows and the badge all work unchanged. */
export const OFFICIAL_SLUG = "biznest-official";
export const isOfficialSlug = (slug: string | null | undefined) => slug === OFFICIAL_SLUG;
export const OFFICIAL_NAME = "BizNest";
export const OFFICIAL_BIO = "The official BizNest account. Product news, tips and updates for Nigerian businesses, straight from the team.";

/**
 * A 1200x630 version of an image for link previews (WhatsApp, Instagram, X). Cloudinary photos are cropped
 * and compressed on the fly so the preview loads fast; other hosts are returned as they are.
 */
export function ogImageUrl(url: string): string {
  const marker = "/image/upload/";
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url) || !url.includes(marker)) return url;
  return url.replace(marker, `${marker}c_fill,g_auto,w_1200,h_630,q_auto:good,f_jpg/`);
}

/** "₦2,500" for a tagged product, or null. Used in link-preview text. */
export function previewPrice(price: number | null | undefined, currency: string | null | undefined): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const symbol = !currency || currency === "NGN" ? "₦" : `${currency} `;
  return `${symbol}${price.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export const postPath = (id: string) => `/browse/p/${id}`;

// ------------------------------------------------------------------ text

/** Links in comments are the #1 spam vector: refuse them outright. */
export function containsLink(text: string): boolean {
  return /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|ng|net|org|co|io|me|ly|info|biz|shop|store|xyz|link|app)\b)/i.test(text);
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** Captions keep line breaks (collapsed to at most one blank line). */
const cleanMultiline = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "";

export function safeHttpsImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.toString();
  } catch { return null; }
}

export type PostInput = { caption?: unknown; images?: unknown };

export function sanitizePost(input: PostInput, opts: { requireImage?: boolean } = {}): { ok: true; caption: string; images: string[] } | { ok: false; error: string } {
  const caption = cleanMultiline(input.caption, BROWSE_CAPTION_MAX);
  const images = (Array.isArray(input.images) ? input.images : []).map(safeHttpsImage).filter((x): x is string => !!x).slice(0, BROWSE_MAX_IMAGES);
  if (!caption && images.length === 0) return { ok: false, error: "Write something or add a photo." };
  if (opts.requireImage && images.length === 0) return { ok: false, error: "Add at least one photo." };
  return { ok: true, caption, images };
}

export function sanitizeComment(input: { body?: unknown; name?: unknown }, opts: { signedInName?: string | null } = {}): { ok: true; body: string; name: string } | { ok: false; error: string } {
  const body = clean(input.body, BROWSE_COMMENT_MAX + 1);
  if (!body) return { ok: false, error: "Write a comment first." };
  if (body.length > BROWSE_COMMENT_MAX) return { ok: false, error: `Keep it under ${BROWSE_COMMENT_MAX} characters.` };
  if (containsLink(body)) return { ok: false, error: "Links aren't allowed in comments." };
  const name = opts.signedInName?.trim() ? clean(opts.signedInName, BROWSE_NAME_MAX) : clean(input.name, BROWSE_NAME_MAX);
  if (name.length < 2) return { ok: false, error: "Enter your name (at least 2 letters)." };
  if (containsLink(name)) return { ok: false, error: "Names can't contain links." };
  return { ok: true, body, name };
}

// ------------------------------------------------------------- viewers

export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,40}$/;
export const userViewerKey = (userId: string) => `u:${userId}`;
export const deviceViewerKey = (deviceId: string) => `d:${deviceId}`;
export const isViewerKey = (k: string) => /^(u|d):[A-Za-z0-9_-]{8,40}$/.test(k);

// -------------------------------------------------------------- cursors

export type FeedCursor = { t: string; id: string };

export function encodeCursor(c: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ t: c.createdAt.toISOString(), id: c.id })).toString("base64url");
}
export function decodeCursor(raw: string | null | undefined): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<FeedCursor>;
    const d = new Date(o.t ?? "");
    if (!Number.isFinite(d.getTime()) || typeof o.id !== "string" || o.id.length > 40) return null;
    return { createdAt: d, id: o.id };
  } catch { return null; }
}

// -------------------------------------------------------------- ranking

/** "Popular": likes and comments, decaying over a week. Pure so it can be tested and reused in-memory. */
export function popularityScore(p: { likeCount: number; commentCount: number; createdAt: Date }, now: Date = new Date()): number {
  const ageH = Math.max(0, (now.getTime() - p.createdAt.getTime()) / 3_600_000);
  return (p.likeCount + 2 * p.commentCount + 1) / Math.pow(ageH + 2, 1.3);
}

// ----------------------------------------------------------------- time

export function timeAgo(date: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

export function defaultProductCaption(name: string): string {
  return `New in the shop: ${name}`.slice(0, BROWSE_CAPTION_MAX);
}

// ------------------------------------------------------------- stories

export const STORY_TTL_MS = 24 * 3_600_000;
export const STORY_TEXT_MAX = 200;
export const STORY_DAILY_LIMIT = 15;
/** Seconds each story stays on screen before moving on. */
export const STORY_SECONDS = 6;
export const STORY_BG_COLORS = ["#0f3d1e", "#1d4ed8", "#7c2d12", "#6d28d9", "#be123c", "#0f766e", "#111827", "#b45309"] as const;
export const storeBrowsePath = (slug: string) => `/browse/s/${slug}`;

export const storyExpiry = (now: Date = new Date()) => new Date(now.getTime() + STORY_TTL_MS);
export const isStoryLive = (s: { status: string; expiresAt: Date }, now: Date = new Date()) => s.status === "ACTIVE" && s.expiresAt.getTime() > now.getTime();

export function sanitizeStory(input: { imageUrl?: unknown; text?: unknown; bgColor?: unknown }):
  | { ok: true; kind: "IMAGE" | "TEXT"; imageUrl: string | null; text: string | null; bgColor: string | null }
  | { ok: false; error: string } {
  const imageUrl = safeHttpsImage(input.imageUrl);
  const text = cleanMultiline(input.text, STORY_TEXT_MAX) || null;
  if (!imageUrl && !text) return { ok: false, error: "Add a photo or write some text." };
  if (imageUrl) return { ok: true, kind: "IMAGE", imageUrl, text, bgColor: null };
  const bg = typeof input.bgColor === "string" && (STORY_BG_COLORS as readonly string[]).includes(input.bgColor) ? input.bgColor : STORY_BG_COLORS[0];
  return { ok: true, kind: "TEXT", imageUrl: null, text, bgColor: bg };
}

/** Rings: stores with unseen stories first (most recently posted first), then fully seen ones. */
export function orderRings<T extends { allSeen: boolean; latestAt: string }>(rings: T[]): T[] {
  return [...rings].sort((a, b) => (a.allSeen === b.allSeen ? (a.latestAt < b.latestAt ? 1 : a.latestAt > b.latestAt ? -1 : 0) : a.allSeen ? 1 : -1));
}

// ------------------------------------------------------------ badges and bio

export const MOGUL_PLAN_NAME = "Business Mogul";
export const BIO_MAX = 500;

/** A business shows the Mogul badge while it is on the Business Mogul plan and the plan is not lapsed. */
export function isMogulStore(store: { subscription?: { name: string } | null; subscriptionPastDueSince?: Date | null } | null | undefined): boolean {
  if (!store?.subscription) return false;
  return store.subscription.name.trim().toLowerCase() === MOGUL_PLAN_NAME.toLowerCase() && !store.subscriptionPastDueSince;
}

/** The business description, tidied for use as a profile bio: plain text, short, no runs of blank lines. */
export function toBio(description: unknown, max = BIO_MAX): string {
  if (typeof description !== "string") return "";
  const t = description.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = Math.max(cut.lastIndexOf(" "), max - 40);
  return `${cut.slice(0, at).trimEnd()}…`;
}
