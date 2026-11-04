import { getCanonicalBusinessType, isRestaurantBusiness } from "@/lib/business-identity";
import { isHotelStore, resolveStorefrontRenderer } from "@/lib/storefront-routing";
import { getTemplateDefinition } from "@/lib/template-registry";

/**
 * Single source of truth for "which built-in pages does this store actually have?"
 *
 * Route guards, the Dashboard > Menus picker, menu save-validation and the
 * storefront menu renderer all ask this module, so a link can never be
 * offered (or rendered) for a page the store's skin doesn't serve.
 * Add a vertical-only page here once, not in five places.
 */
export type StoreIdentity = {
  businessCategory?: string | null;
  storeBusinessType?: string | null;
  templateName?: string | null;
};
export type StoreKind = "hotel" | "restaurant" | "other";

/** True when the Grandeur (restaurant) skin is the right one for this store. */
export function isGrandeurStore(i: StoreIdentity): boolean {
  if (resolveStorefrontRenderer(i) === "grandeur") return true;
  return isRestaurantBusiness(getCanonicalBusinessType({ businessCategory: i.businessCategory, storeBusinessType: i.storeBusinessType }));
}

/**
 * True when the shop-flow pages (menu, category, cart, checkout, contact) should wear the Grandeur restaurant skin.
 * A registered template decides for itself: Ember is a restaurant template that is drawn by the Builder, so its inner
 * pages must stay Builder too (switching to Grandeur half way through the site was the "two templates" bug). Only a
 * store with no registered template falls back to its business category.
 */
export function usesGrandeurSkin(i: StoreIdentity): boolean {
  const def = getTemplateDefinition(i.templateName);
  if (def) return def.renderer === "grandeur";
  return isGrandeurStore(i);
}

export function getStoreKind(i: StoreIdentity): StoreKind {
  if (isHotelStore(i)) return "hotel";
  if (isGrandeurStore(i)) return "restaurant";
  return "other";
}

/**
 * Vertical-only built-in pages. Anything not listed here is served for every
 * store type (about, contact, catalog, services, cart, orders, ...).
 */
const PAGE_RULES: Record<string, (i: StoreIdentity) => boolean> = {
  "/gallery": (i) => isHotelStore(i) || isGrandeurStore(i),
  "/events": (i) => isHotelStore(i) || isGrandeurStore(i),
  "/reservations": (i) => isGrandeurStore(i) || resolveStorefrontRenderer(i) === "tastehouse",
  "/rooms": isHotelStore,
  "/amenities": isHotelStore,
  "/dining": isHotelStore,
  "/experiences": isHotelStore,
  "/facilities": isHotelStore,
  "/book": isHotelStore,
};

/**
 * Slugs of the pages the owner has written AND published in Customize > Pages (only /blog and /gallery matter here).
 * Pass it when the answer must reflect what the store really has; leave it out for the template-only rules.
 */
export type WrittenPages = ReadonlySet<string>;

export function isStorePageAvailable(path: string, identity: StoreIdentity, written?: WrittenPages): boolean {
  const rule = PAGE_RULES[path];
  const base = rule ? rule(identity) : true;
  if (!written) return base;
  // Blog exists only once the owner wrote it. Gallery is a template page for hotels and restaurants and
  // otherwise exists only once the owner wrote it.
  if (path === "/blog") return written.has("blog");
  if (path === "/gallery") return base || written.has("gallery");
  return base;
}

export function filterAvailablePages<T extends { path: string }>(options: T[], identity: StoreIdentity, written?: WrittenPages): T[] {
  return options.filter((o) => isStorePageAvailable(o.path, identity, written));
}
