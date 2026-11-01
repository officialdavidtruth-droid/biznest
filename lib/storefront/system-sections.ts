import { sanitizeBlocks, type PageBlock } from "@/lib/storefront/page-blocks";

/**
 * Sections around the pages the platform draws itself: Shop, Product and Cart.
 *
 * Shopify-style: the page's main part (the product grid, the product detail, the cart and its checkout button) is
 * owned by code and can never be removed or broken. The owner adds blocks above and below it. They are stored in
 * Store.sectionOverrides.systemPages, which survives a template switch, so nothing is lost when the look changes.
 * Pure functions, safe for client components.
 */

export type SystemPageKey = "shop" | "product" | "cart";
export const SYSTEM_PAGE_KEYS: readonly SystemPageKey[] = ["shop", "product", "cart"];
export const SYSTEM_SECTIONS_KEY = "systemPages";

export type SystemSections = { above: PageBlock[]; below: PageBlock[] };
export type SystemSectionsMap = Record<SystemPageKey, SystemSections>;

export const SYSTEM_PAGE_LABELS: Record<SystemPageKey, { title: string; main: string; hint: string }> = {
  shop: { title: "Shop page", main: "your product grid", hint: "Your products are always shown. Add banners, notes or featured products around them." },
  product: { title: "Product page", main: "the product details and Add to cart", hint: "Every product page keeps its photos, price and Add to cart. Add blocks such as a delivery note or related products." },
  cart: { title: "Cart page", main: "the cart and checkout button", hint: "The cart and checkout button always stay. Add a note, a promise or suggested products around them." },
};

export const EMPTY_SYSTEM_SECTIONS: SystemSections = { above: [], below: [] };

export function isSystemPageKey(v: unknown): v is SystemPageKey {
  return typeof v === "string" && (SYSTEM_PAGE_KEYS as readonly string[]).includes(v);
}

/** Validates untrusted data from the editor or from storage. Unsafe or empty blocks are dropped, never repaired. */
export function sanitizeSystemSections(input: unknown): SystemSections {
  const o = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const above = sanitizeBlocks(o.above);
  const used = new Set(above.map((b) => b.id));
  // Catalogue blocks are looked up by block id, so an id must not repeat between the two lists.
  const below = sanitizeBlocks(o.below).map((b) => (used.has(b.id) ? ({ ...b, id: `b-${b.id}`.slice(0, 40) } as PageBlock) : b));
  return { above, below };
}

/** One page's saved sections, validated again on every read. */
export function readSystemSections(sectionOverrides: unknown, key: SystemPageKey): SystemSections {
  if (!sectionOverrides || typeof sectionOverrides !== "object" || Array.isArray(sectionOverrides)) return EMPTY_SYSTEM_SECTIONS;
  const all = (sectionOverrides as Record<string, unknown>)[SYSTEM_SECTIONS_KEY];
  if (!all || typeof all !== "object" || Array.isArray(all)) return EMPTY_SYSTEM_SECTIONS;
  return sanitizeSystemSections((all as Record<string, unknown>)[key]);
}

export function readAllSystemSections(sectionOverrides: unknown): SystemSectionsMap {
  return { shop: readSystemSections(sectionOverrides, "shop"), product: readSystemSections(sectionOverrides, "product"), cart: readSystemSections(sectionOverrides, "cart") };
}

/** The document to store after one page's sections change. Other pages and other keys of the document are left exactly as they were. */
export function withSystemSections(current: Record<string, unknown>, key: SystemPageKey, sections: SystemSections): Record<string, unknown> {
  const existing = current[SYSTEM_SECTIONS_KEY];
  const all = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
  if (sections.above.length === 0 && sections.below.length === 0) delete all[key];
  else all[key] = sections;
  const next = { ...current };
  if (Object.keys(all).length === 0) delete next[SYSTEM_SECTIONS_KEY];
  else next[SYSTEM_SECTIONS_KEY] = all;
  return next;
}
