import { APP_URL } from "@/lib/constants/app-url";

/**
 * "Powered by BizNest" credit. Shown for stores that have not started paying for a plan
 * (free plan / free trial); a store with active card billing (subscriptionRenewsAt set) has it removed.
 * Never shown for the official BizNest store itself.
 */

export function showBizNestBranding(store: { slug?: string | null; subscriptionRenewsAt?: Date | string | null }): boolean {
  if (store.slug === "biznest") return false;
  return !store.subscriptionRenewsAt;
}

/** Link back to BizNest, tagged so signups can be traced to the store and surface that sent them. */
export function biznestPromoUrl(slug: string | null | undefined, medium: "storefront" | "receipt" | "email"): string {
  const q = new URLSearchParams({ utm_source: "store", utm_medium: medium, utm_campaign: "powered_by" });
  if (slug) q.set("ref", slug);
  return `${APP_URL.replace(/\/+$/, "")}/?${q.toString()}`;
}

export const BIZNEST_PROMO_TEXT = "Powered by BizNest";
export const BIZNEST_PROMO_CTA = "Open your free store";
