import slugify from "slugify";

/** The BizNest Blog app, modelled on Shopify: blogs hold articles, organised by tags, with Visible / Hidden / Scheduled. */
export const BLOG_PLUGIN_KEY = "blog";

/** Business types that publish content to attract customers. Super admin can widen this in /supaadmin/apps. */
export const BLOG_BUSINESS_TYPES = [
  "Travel & Tourism", "Real Estate", "Professional Services", "Agency", "Software Development", "Photography",
  "Health", "Health & Fitness", "Beauty", "Salon", "Event Planning", "Church", "Construction", "Automotive", "Agriculture", "HR & Recruitment",
];

export const BLOG_PAGE_SIZE = 9;
export const BLOG_MAX_TAGS = 10;

export function blogHandle(input: string): string {
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

export type Visibility = "VISIBLE" | "HIDDEN" | "SCHEDULED";
export const DEFAULT_BLOG = { title: "News", handle: "news" } as const;

/** What visitors see: a publish date that has arrived. Hidden (null) and future-dated articles stay out. */
export function publicArticleWhere(storeId: string, now = new Date()) {
  return { storeId, publishedAt: { not: null, lte: now } };
}

/** Shopify's three states from one field: null = Hidden, future = Scheduled, otherwise Visible. */
export function visibilityOf(publishedAt: Date | string | null | undefined, now = new Date()): Visibility {
  if (!publishedAt) return "HIDDEN";
  return new Date(publishedAt) > now ? "SCHEDULED" : "VISIBLE";
}

/**
 * Turn what the owner chose into a publishedAt value.
 * Visible keeps an existing past date (so editing a live article never changes its date), otherwise now.
 */
export function resolvePublishedAt(
  visibility: Visibility,
  publishDate: Date | null,
  existing: Date | null,
  now = new Date(),
): { publishedAt: Date | null } | { error: string } {
  if (visibility === "HIDDEN") return { publishedAt: null };
  if (publishDate) {
    if (Number.isNaN(publishDate.getTime())) return { error: "That publish date is not valid." };
    return { publishedAt: publishDate };
  }
  if (existing && existing <= now) return { publishedAt: existing };
  return { publishedAt: now };
}

export function formatPostDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Shopify-style address: /blogs/<blog>/<article>. */
export function articlePath(storeSlug: string, blog: string, articleHandle?: string) {
  return `/store/${storeSlug}/blogs/${blog}${articleHandle ? `/${articleHandle}` : ""}`;
}
