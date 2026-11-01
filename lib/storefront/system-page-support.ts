import { isHotelBusiness, isRestaurantBusiness } from "@/lib/business-identity";
import { TASTEHOUSE_TEMPLATE_NAME } from "@/lib/template-themes";
import { EXAMPLE_TEMPLATE_NAME } from "@/lib/example-content";
import type { SystemPageKey } from "@/lib/storefront/system-sections";

/**
 * Which platform pages the standard storefront draws, and so can show owner blocks. Hotel, restaurant, TasteHouse and
 * the Example template draw their own Shop and Cart pages; the product page is shared by every template. Mirrors the
 * routing in app/store/[slug]/catalog/page.tsx and cart/page.tsx.
 */
export function systemPageSupport(store: { templateName?: string | null; businessCategory?: string | null }): Record<SystemPageKey, boolean> {
  const name = store.templateName ?? "";
  const ownCatalog = name === "Veloura — Superior Luxury Hotel" || isHotelBusiness(store.businessCategory) || name === EXAMPLE_TEMPLATE_NAME || name === TASTEHOUSE_TEMPLATE_NAME || isRestaurantBusiness(store.businessCategory);
  const ownCart = name === EXAMPLE_TEMPLATE_NAME || name === TASTEHOUSE_TEMPLATE_NAME || String(store.businessCategory ?? "").toLowerCase() === "restaurant";
  return { shop: !ownCatalog, product: true, cart: !ownCart };
}
