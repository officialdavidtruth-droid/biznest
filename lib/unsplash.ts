/**
 * Auto-populated demo photography, not fabricated content — this fetches
 * real stock photos from Unsplash, it doesn't invent anything. Entirely
 * optional: without UNSPLASH_ACCESS_KEY set, every function here returns
 * null and callers fall back to the existing CSS/monogram treatment. Get a
 * free key at https://unsplash.com/developers (demo tier: 50 requests/hour,
 * fine for occasional store creation — not meant for per-pageview calls,
 * see callers for where results get persisted instead of re-fetched).
 */

export async function fetchUnsplashPhoto(query: string): Promise<string | null> {
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
    // Network hiccup or rate limit — never let a photo lookup block store
    // creation. Caller's existing fallback (CSS/monogram) just applies.
    return null;
  }
}

/** Fetches photos for several queries in parallel — used to fill a batch of sample listings at once. */
export async function fetchUnsplashPhotos(queries: string[]): Promise<(string | null)[]> {
  return Promise.all(queries.map(fetchUnsplashPhoto));
}
