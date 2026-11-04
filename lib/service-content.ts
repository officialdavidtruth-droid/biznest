/**
 * Merchant-written page content for a service / package, stored as JSON text in
 * `Service.attributes.pageBlocks` (no schema change). Every block is optional and
 * only appears on the storefront when the merchant filled it in — nothing here is
 * niche-specific, so a trip, a salon treatment or a consultation all use the same blocks.
 */
export type ServiceContent = {
  /** Long write-up (the "blog post" part): same light markdown as product descriptions. */
  story: string;
  highlights: { label: string; value: string }[];
  itinerary: { title: string; text: string }[];
  included: string[];
  excluded: string[];
  faqs: { q: string; a: string }[];
  /** Where it happens / meeting point. Overrides the business address on this page. */
  location: string;
  /** Link to one of the store's blog articles: "blogHandle/articleHandle". */
  article: string;
  /** Show an enquiry form on the page. undefined = on for non-bookable items, off for bookable ones. */
  enquiry?: boolean;
};

export const SERVICE_CONTENT_KEY = "pageBlocks";
export const CONTENT_LIMITS = { story: 8000, short: 160, text: 1000, items: 30, total: 30000 } as const;

export const emptyServiceContent = (): ServiceContent => ({ story: "", highlights: [], itinerary: [], included: [], excluded: [], faqs: [], location: "", article: "" });

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = <T,>(v: unknown, map: (x: any) => T | null): T[] =>
  (Array.isArray(v) ? v : []).slice(0, CONTENT_LIMITS.items).map(map).filter((x): x is T => x !== null);

export function normalizeServiceContent(input: unknown): ServiceContent {
  const o = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const line = (x: unknown) => str(x, CONTENT_LIMITS.short) || null;
  return {
    story: str(o.story, CONTENT_LIMITS.story),
    highlights: list(o.highlights, (x) => { const label = str(x?.label, 60), value = str(x?.value, CONTENT_LIMITS.short); return label && value ? { label, value } : null; }),
    itinerary: list(o.itinerary, (x) => { const title = str(x?.title, CONTENT_LIMITS.short), text = str(x?.text, CONTENT_LIMITS.text); return title || text ? { title, text } : null; }),
    included: list(o.included, line),
    excluded: list(o.excluded, line),
    faqs: list(o.faqs, (x) => { const q = str(x?.q, CONTENT_LIMITS.short), a = str(x?.a, CONTENT_LIMITS.text); return q && a ? { q, a } : null; }),
    location: str(o.location, 200),
    article: /^[\w-]+\/[\w-]+$/.test(str(o.article, 200)) ? str(o.article, 200) : "",
    ...(typeof o.enquiry === "boolean" ? { enquiry: o.enquiry } : {}),
  };
}

/** Read from Service.attributes (tolerates missing / malformed data). */
export function readServiceContent(attributes: unknown): ServiceContent {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return emptyServiceContent();
  const raw = (attributes as Record<string, unknown>)[SERVICE_CONTENT_KEY];
  if (typeof raw !== "string" || !raw) return emptyServiceContent();
  try { return normalizeServiceContent(JSON.parse(raw)); } catch { return emptyServiceContent(); }
}

/** JSON text to store, or "" when there is nothing to keep. */
export function serializeServiceContent(content: unknown): string {
  const c = normalizeServiceContent(content);
  const hasAny = c.story || c.highlights.length || c.itinerary.length || c.included.length || c.excluded.length || c.faqs.length || c.location || c.article || c.enquiry !== undefined;
  const json = hasAny ? JSON.stringify(c) : "";
  return json.length <= CONTENT_LIMITS.total ? json : "";
}
