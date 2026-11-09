/**
 * TEMPORARY testing aid. Stores listed here get a "Switch business type" card in Settings, so the owner can
 * flip the store between niches (Restaurant, Hotel, Fashion...) and check each niche's dashboard and apps.
 * Remove the slug (or this file and the card) when testing is over.
 */
export const NICHE_TEST_SLUGS: readonly string[] = ["velox-space"];
export const isNicheTestStore = (slug: string) => NICHE_TEST_SLUGS.includes(slug);
