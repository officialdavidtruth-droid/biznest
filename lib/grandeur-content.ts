import { prisma } from "@/lib/prisma";

/**
 * Vendor-editable content for the Grandeur restaurant template's Events and
 * Gallery pages (see components/dashboard/grandeur-content-manager.tsx for
 * the admin editor, and lib/actions/grandeur-content.ts for the save
 * actions). Persisted as a namespaced bucket inside Store.storefrontConfig
 * -- the same free-form JSON field lib/storefront/unit-booking-niche.ts
 * already uses for per-template config -- so no schema migration is needed
 * to add this.
 */

export type GrandeurEvent = {
  id: string;
  slug: string;
  title: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string;
  venue: string;
  description: string;
  details: string;
  image: string;
  featured: boolean;
};

export type GrandeurGalleryItem = {
  id: string;
  title: string;
  category: string;
  image: string;
  description?: string;
};

export type GrandeurVideo = {
  id: string;
  title: string;
  category?: string;
  videoUrl: string;
  thumbnail: string;
  description?: string;
};

export const EVENT_CATEGORIES = [
  "Wine Dinners",
  "Live Music",
  "Themed Nights",
  "Private Events",
  "Corporate Events",
  "Seasonal Events",
] as const;

export const GALLERY_CATEGORIES = [
  "Restaurant Interior",
  "Food & Drinks",
  "Private Dining",
  "Events",
  "Outdoor Terrace",
  "Our People",
] as const;

type GrandeurStorefrontConfig = {
  grandeurEvents?: { events: GrandeurEvent[] };
  grandeurGallery?: { items: GrandeurGalleryItem[]; videos: GrandeurVideo[] };
};

async function loadStorefrontConfig(slug: string): Promise<GrandeurStorefrontConfig> {
  const store = await prisma.store.findUnique({ where: { slug }, select: { storefrontConfig: true } });
  return (store?.storefrontConfig as GrandeurStorefrontConfig | null) ?? {};
}

/** Public read used by the Events list page and the Event detail page. */
export async function getGrandeurEvents(slug: string): Promise<{ events: GrandeurEvent[] }> {
  const config = await loadStorefrontConfig(slug);
  return config.grandeurEvents ?? { events: [] };
}

/** Public read used by the Gallery page. */
export async function getGrandeurGallery(slug: string): Promise<{ items: GrandeurGalleryItem[]; videos: GrandeurVideo[] }> {
  const config = await loadStorefrontConfig(slug);
  return config.grandeurGallery ?? { items: [], videos: [] };
  }
