/**
 * Default (stock) photos used when a merchant has not uploaded their own.
 *
 * By default these are hotlinked from Unsplash. To self-host them (recommended):
 *   1. run `node scripts/fetch-default-images.mjs`  (downloads them into public/defaults/)
 *   2. set NEXT_PUBLIC_DEFAULT_IMAGE_BASE_URL=/defaults
 * Nothing else needs to change: every default photo goes through defaultPhoto().
 */
const BASE = (process.env.NEXT_PUBLIC_DEFAULT_IMAGE_BASE_URL || "").replace(/\/$/, "");

export function defaultPhoto(id: string, width = 1600): string {
  if (BASE) return `${BASE}/${id}.jpg`;
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
}
