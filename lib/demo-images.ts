/**
 * Auto-populated demo photography — real photos, not fabricated content.
 *
 * Works with ZERO configuration: every new store gets relevant photos by
 * default via LoremFlickr (keyword-based, no signup, no API key). If
 * UNSPLASH_ACCESS_KEY is ever set, that's used instead for higher-quality,
 * more relevant results — but nothing requires it. This is the fix for
 * "please add default generated images" landing as an actual default, not
 * an opt-in that needs more setup.
 */

async function fetchFromUnsplash(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

/**
 * LoremFlickr resolves keyword-tagged photos with no API call needed here
 * at all — it's a direct, stable image URL the browser resolves later.
 * Always "succeeds" in the sense that it always returns a usable URL;
 * whether a *good* photo comes back depends on how well the query
 * matches Flickr tags, which is why callers pass simple, generic keywords
 * (a niche category) rather than a full product name.
 */
function loremFlickrUrl(query: string): string {
  const tags = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(",");
  return `https://loremflickr.com/800/600/${encodeURIComponent(tags || "business")}`;
}

/** Best available photo for one query — Unsplash if configured, LoremFlickr always as the zero-config default. */
export async function fetchDemoPhoto(query: string): Promise<string | null> {
  const unsplash = await fetchFromUnsplash(query);
  if (unsplash) return unsplash;
  return loremFlickrUrl(query);
}

/** Same, for several queries at once — used to fill a batch of sample listings in parallel. */
export async function fetchDemoPhotos(queries: string[]): Promise<(string | null)[]> {
  return Promise.all(queries.map(fetchDemoPhoto));
}
