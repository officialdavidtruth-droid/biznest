import { isSafeHref, isSecureImageUrl } from "@/lib/builder-safe";
import { ownerPageBody } from "@/lib/storefront/page-registry";
import { parseBlogPosts, parseGalleryBody } from "@/lib/storefront/owner-page-format";

/**
 * Block content for the pages an owner writes in Customize > Pages.
 *
 * A page row stores { body, blocks }. `body` is always the plain-text version of the blocks, so everything that
 * only reads text (menu checks, search, older renderers) keeps working, and pages saved before blocks existed
 * ({ body } only) open in the editor as text blocks. Pure functions, safe for client components.
 */

export type BlockType = "heading" | "text" | "image" | "button" | "faq" | "gallery" | "divider" | "products" | "collection";

export type CollectionSort = "newest" | "price-asc" | "price-desc";
export const COLLECTION_LIMITS = [4, 8, 12] as const;
export const MAX_PRODUCTS_PER_BLOCK = 12;
export const MAX_CATALOG_BLOCKS = 6;

export type PageBlock =
  | { id: string; type: "heading"; text: string; level: 2 | 3 }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; url: string; alt: string; caption: string }
  | { id: string; type: "button"; label: string; href: string }
  | { id: string; type: "faq"; items: { q: string; a: string }[] }
  | { id: string; type: "gallery"; images: { url: string; caption: string }[] }
  | { id: string; type: "divider" }
  // Catalogue blocks store only references. Names, prices and photos are read from the catalogue when the page is
  // shown, so a price change or an unpublished product is never out of date on the page.
  | { id: string; type: "products"; title: string; productIds: string[] }
  // categoryId "" means every product in the store.
  | { id: string; type: "collection"; title: string; categoryId: string; limit: 4 | 8 | 12; sort: CollectionSort };

export const MAX_BLOCKS = 60;
export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading", text: "Text", image: "Image", button: "Button", faq: "Questions", gallery: "Photo grid", divider: "Divider", products: "Products", collection: "Collection",
};

/** Pages that still use the plain-text editor. Policies is legal text the owner writes in their own words, so it stays plain text. */
const TEXT_FORMAT_SLUGS = new Set(["policies"]);
export function pageUsesBlocks(slug: string): boolean {
  return !TEXT_FORMAT_SLUGS.has(slug.trim().toLowerCase());
}

const ID_RE = /^[a-z0-9_-]{1,64}$/i;
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").slice(0, max) : "");
const rid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(type: BlockType): PageBlock {
  const id = rid();
  switch (type) {
    case "heading": return { id, type, text: "", level: 2 };
    case "text": return { id, type, text: "" };
    case "image": return { id, type, url: "", alt: "", caption: "" };
    case "button": return { id, type, label: "", href: "" };
    case "faq": return { id, type, items: [{ q: "", a: "" }] };
    case "gallery": return { id, type, images: [] };
    case "divider": return { id, type };
    case "products": return { id, type, title: "", productIds: [] };
    case "collection": return { id, type, title: "", categoryId: "", limit: 4, sort: "newest" };
  }
}

/** Validates untrusted block data (from the editor or from storage). Anything unsafe or empty is dropped, never repaired. */
export function sanitizeBlocks(input: unknown): PageBlock[] {
  if (!Array.isArray(input)) return [];
  const out: PageBlock[] = [];
  const seen = new Set<string>();
  let catalogBlocks = 0;
  for (const raw of input.slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    let id = typeof b.id === "string" && /^[a-z0-9-]{1,40}$/i.test(b.id) ? b.id : rid();
    if (seen.has(id)) id = rid();
    seen.add(id);
    switch (b.type) {
      case "heading": {
        const text = clip(b.text, 160).trim();
        if (text) out.push({ id, type: "heading", text, level: b.level === 3 ? 3 : 2 });
        break;
      }
      case "text": {
        const text = clip(b.text, 5000).trim();
        if (text) out.push({ id, type: "text", text });
        break;
      }
      case "image": {
        const url = clip(b.url, 2000).trim();
        if (url && isSecureImageUrl(url)) out.push({ id, type: "image", url, alt: clip(b.alt, 200).trim(), caption: clip(b.caption, 300).trim() });
        break;
      }
      case "button": {
        const label = clip(b.label, 60).trim();
        const href = clip(b.href, 2000).trim();
        if (label && href && isSafeHref(href)) out.push({ id, type: "button", label, href });
        break;
      }
      case "faq": {
        const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).flatMap((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const q = clip(o.q, 300).trim();
          const a = clip(o.a, 2000).trim();
          return q && a ? [{ q, a }] : [];
        });
        if (items.length) out.push({ id, type: "faq", items });
        break;
      }
      case "gallery": {
        const images = (Array.isArray(b.images) ? b.images : []).slice(0, 24).flatMap((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const url = clip(o.url, 2000).trim();
          return url && isSecureImageUrl(url) ? [{ url, caption: clip(o.caption, 200).trim() }] : [];
        });
        if (images.length) out.push({ id, type: "gallery", images });
        break;
      }
      case "divider":
        out.push({ id, type: "divider" });
        break;
      case "products": {
        const seenIds = new Set<string>();
        const productIds = (Array.isArray(b.productIds) ? b.productIds : []).flatMap((v) => {
          if (typeof v !== "string" || !ID_RE.test(v) || seenIds.has(v)) return [];
          seenIds.add(v);
          return [v];
        }).slice(0, MAX_PRODUCTS_PER_BLOCK);
        if (productIds.length && catalogBlocks < MAX_CATALOG_BLOCKS) { catalogBlocks++; out.push({ id, type: "products", title: clip(b.title, 120).trim(), productIds }); }
        break;
      }
      case "collection": {
        const categoryId = typeof b.categoryId === "string" && ID_RE.test(b.categoryId) ? b.categoryId : "";
        const limit = b.limit === 8 ? 8 : b.limit === 12 ? 12 : 4;
        const sort: CollectionSort = b.sort === "price-asc" || b.sort === "price-desc" ? b.sort : "newest";
        if (catalogBlocks < MAX_CATALOG_BLOCKS) { catalogBlocks++; out.push({ id, type: "collection", title: clip(b.title, 120).trim(), categoryId, limit, sort }); }
        break;
      }
    }
  }
  return out;
}

/** The plain-text version stored as `body`. FAQ blocks become blank-line separated question/answer pairs and photo grids become "url | caption" lines, the formats the older renderers already read. */
export function blocksToPlainText(blocks: PageBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading": case "text": parts.push(b.text); break;
      case "image": { const t = b.caption || b.alt; if (t) parts.push(t); break; }
      case "button": parts.push(b.label); break;
      case "faq": parts.push(b.items.map((i) => `${i.q}\n${i.a}`).join("\n\n")); break;
      case "gallery": parts.push(b.images.map((i) => (i.caption ? `${i.url} | ${i.caption}` : i.url)).join("\n")); break;
      case "divider": break;
      case "products": case "collection": if (b.title) parts.push(b.title); break;
    }
  }
  return parts.join("\n\n").trim();
}

/** Opens an older text-only page in the block editor: one text block per paragraph. */
export function textToBlocks(body: string): PageBlock[] {
  return sanitizeBlocks(body.split(/\n{2,}/).map((t) => ({ type: "text", text: t })));
}

/**
 * Opens a page saved before blocks existed in the block editor. Gallery, FAQ and Blog used fixed text formats
 * ("url | caption" lines, blank-line separated questions, "---" between posts); each becomes the matching blocks so
 * nothing the owner wrote is lost. Other pages become one text block per paragraph.
 */
export function legacyTextToBlocks(slug: string, body: string): PageBlock[] {
  const s = slug.trim().toLowerCase();
  if (s === "gallery") {
    const g = parseGalleryBody(body);
    const out: unknown[] = [];
    if (g.intro) out.push({ type: "text", text: g.intro });
    for (let i = 0; i < g.images.length; i += 24) out.push({ type: "gallery", images: g.images.slice(i, i + 24) });
    return sanitizeBlocks(out);
  }
  if (s === "faq") {
    const items = body.split(/\n{2,}/).map((b) => b.trim().split("\n")).map(([q, ...a]) => ({ q: (q ?? "").trim(), a: a.join("\n").trim() })).filter((x) => x.q && x.a).slice(0, 30);
    return sanitizeBlocks(items.length ? [{ type: "faq", items }] : []);
  }
  if (s === "blog") {
    const out: unknown[] = [];
    parseBlogPosts(body).forEach((p, i) => {
      if (i > 0) out.push({ type: "divider" });
      out.push({ type: "heading", text: p.title, level: 2 });
      if (p.text) out.push({ type: "text", text: p.text });
    });
    return sanitizeBlocks(out);
  }
  return textToBlocks(body);
}

/** The saved blocks of a page row, validated again on every read. */
export function ownerPageBlocks(content: unknown): PageBlock[] {
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  return sanitizeBlocks((content as { blocks?: unknown }).blocks);
}

/** True when an owner page has anything to show: written text or at least one block. */
export function hasPageContent(content: unknown): boolean {
  return (ownerPageBody(content) ?? "").trim() !== "" || ownerPageBlocks(content).length > 0;
}
