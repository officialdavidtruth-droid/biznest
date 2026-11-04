import { isHotelBusiness, isRestaurantBusiness } from "@/lib/business-identity";
import type { SystemPageKey } from "@/lib/storefront/system-sections";

/**
 * Which platform pages the standard storefront draws, and so can show owner blocks. Hotel, restaurant, TasteHouse and
 * the Example template draw their own Shop and Cart pages; the product page is shared by every template. Mirrors the
 * routing in app/store/[slug]/catalog/page.tsx and cart/page.tsx.
 */
export function systemPageSupport(store: { templateName?: string | null; businessCategory?: string | null }): Record<SystemPageKey, boolean> {
  const name = store.templateName ?? "";
  const ownCatalog = name === "Veloura — Superior Luxury Hotel" || isHotelBusiness(store.businessCategory) || isRestaurantBusiness(store.businessCategory);
  const ownCart = String(store.businessCategory ?? "").toLowerCase() === "restaurant";
  return { shop: !ownCatalog, product: true, cart: !ownCart };
}
