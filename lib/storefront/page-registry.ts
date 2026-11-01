/**
 * Single source of truth for the pages a merchant can write in Customize > Pages.
 *
 * Three kinds of rows share the StorePage table, and only the first is a "content page":
 *  1. Owner text pages   content = { body: string }            (About, FAQ, custom pages ...)
 *  2. Template content   content = anything else               (hotel-*, events, tastehouse-home, template galleries)
 *  3. Legacy placeholders content = { blocks: [] }             (old store-creation seed, never had content)
 *
 * Pure functions, safe to import from client components.
 */

export const CONTENT_PAGES = [
  { slug: "about", title: "About" },
  { slug: "gallery", title: "Gallery" },
  { slug: "faq", title: "FAQ" },
  { slug: "blog", title: "Blog" },
  { slug: "contact", title: "Contact" },
  { slug: "policies", title: "Policies" },
] as const;

/**
 * Pages drawn by the platform, not written by the merchant. Their layout is edited through sections
 * (Sections / Content panels), never through the Pages list. A request for one of these without owner
 * content is sent to where the content really lives (see SYSTEM_PAGE_REDIRECTS).
 */
export const SYSTEM_PAGE_REDIRECTS: Record<string, string> = {
  home: "",
  products: "/catalog",
  testimonials: "#testimonials",
};

/** The page body when this row is an owner text page, otherwise null. */
export function ownerPageBody(content: unknown): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) return null;
  const body = (content as { body?: unknown }).body;
  return typeof body === "string" ? body : null;
}

/** The empty row older store creation seeded for every page name. */
export function isPlaceholderContent(content: unknown): boolean {
  if (!content || typeof content !== "object" || Array.isArray(content)) return false;
  const c = content as { body?: unknown; blocks?: unknown };
  return typeof c.body !== "string" && Array.isArray(c.blocks) && c.blocks.length === 0 && Object.keys(c).length === 1;
}
