import { OFFICIAL_SLUG } from "@/lib/browse";

/** The demo store is the official BizNest account's store. No other store gets the niche switcher. */
export const DEMO_STORE_SLUG = OFFICIAL_SLUG;
export const DEMO_STORE_EMAIL = "official@biznest.space";
export const DEMO_DEFAULT_NICHE = "Fashion & Apparel";
export const DEMO_PASSWORD_MIN = 10;

export const isDemoStoreSlug = (slug: string | null | undefined): boolean => slug === DEMO_STORE_SLUG;
