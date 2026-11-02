import slugify from "slugify";

/** The BizNest Blog app. Dated posts with categories, tags, scheduling, SEO fields and an RSS feed. */
export const BLOG_PLUGIN_KEY = "blog";
export const BLOG_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

/** Business types that publish content to attract customers. Super admin can widen this in /supaadmin/apps. */
export const BLOG_BUSINESS_TYPES = [
  "Travel & Tourism", "Real Estate", "Professional Services", "Agency", "Software Development", "Photography",
  "Health", "Health & Fitness", "Beauty", "Salon", "Event Planning", "Church", "Construction", "Automotive", "Agriculture",
];

export const BLOG_PAGE_SIZE = 9;
export const BLOG_MAX_TAGS = 10;

export function blogSlug(input: string): string {
  return slugify(input, { lower: true, strict: true, trim: true }).slice(0, 80);
}

export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(markdown: string): number {
  const t = plainText(markdown);
  return t ? t.split(" ").length : 0;
}

/** ~220 words a minute, never less than one minute. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / 220));
}

/** The owner's excerpt, or the first ~160 characters of the post cut at a word boundary. */
export function excerptFor(post: { excerpt?: string | null; body: string }, max = 160): string {
  const own = post.excerpt?.trim();
  if (own) return own;
  const text = plainText(post.body);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trim()}…`;
}

export function normaliseTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t).trim().replace(/\s+/g, " ").slice(0, 32);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= BLOG_MAX_TAGS) break;
  }
  return out;
}

/** What visitors see: published, or scheduled and now due. Scheduling needs no cron job. */
export function publicPostWhere(storeId: string, now = new Date()) {
  return { storeId, status: { in: ["PUBLISHED", "SCHEDULED"] as ("PUBLISHED" | "SCHEDULED")[] }, publishedAt: { not: null, lte: now } };
}

/** The state to show the owner: a scheduled post whose time has passed is live. */
export function effectiveStatus(post: { status: BlogStatus; publishedAt: Date | string | null }, now = new Date()): BlogStatus {
  if (post.status === "SCHEDULED" && post.publishedAt && new Date(post.publishedAt) <= now) return "PUBLISHED";
  return post.status;
}

/** Decide status and publishedAt from what the owner asked for. */
export function resolveStatus(
  intent: BlogStatus,
  scheduledFor: Date | null,
  existing: { status: BlogStatus; publishedAt: Date | null } | null,
  now = new Date(),
): { status: BlogStatus; publishedAt: Date | null } | { error: string } {
  if (intent === "DRAFT") return { status: "DRAFT", publishedAt: null };
  if (intent === "SCHEDULED") {
    if (!scheduledFor) return { error: "Choose a date and time to schedule this post." };
    if (scheduledFor.getTime() <= now.getTime()) return { error: "The scheduled time must be in the future." };
    return { status: "SCHEDULED", publishedAt: scheduledFor };
  }
  // Publish now. Keep the original date when a post that is already live is edited.
  if (existing && effectiveStatus(existing, now) === "PUBLISHED" && existing.publishedAt) return { status: "PUBLISHED", publishedAt: existing.publishedAt };
  return { status: "PUBLISHED", publishedAt: now };
}

export function formatPostDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function blogPath(storeSlug: string, postSlug?: string) {
  return `/store/${storeSlug}/blog${postSlug ? `/${postSlug}` : ""}`;
}
