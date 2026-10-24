import { getCanonicalBusinessType, isRestaurantBusiness } from "@/lib/business-identity";
import { isHotelStore, resolveStorefrontRenderer } from "@/lib/storefront-routing";

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

export function isStorePageAvailable(path: string, identity: StoreIdentity): boolean {
  const rule = PAGE_RULES[path];
  return rule ? rule(identity) : true;
}

export function filterAvailablePages<T extends { path: string }>(options: T[], identity: StoreIdentity): T[] {
  return options.filter((o) => isStorePageAvailable(o.path, identity));
}
