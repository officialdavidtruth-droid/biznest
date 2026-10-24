// A hotel only gets Dining (nav link, /dining page, dining copy) when the business ALSO
// operates a restaurant. Hotel-only businesses must show nothing dining-related.
// There is no dedicated multi-niche column today (Business has one category + subcategory),
// so "also a restaurant" is detected from the signals that exist:
//  - the business category / subcategory names a restaurant/dining/food niche, or
//  - the store has published items filed under a dining/restaurant/menu category.
const DINING_RE = /\b(restaurant|dining|cafe|café|bar|grill|kitchen|food|menu|eatery|bistro|catering)\b/i;

export function hotelHasDining(input: { category?: string | null; subcategory?: string | null; itemCategoryNames?: Array<string | null | undefined> }): boolean {
  const parts = [input.category, input.subcategory].filter(Boolean) as string[];
  if (parts.some((p) => /restaurant/i.test(p) || (!/hotel|lodging/i.test(p) && DINING_RE.test(p)) || /hotel[^,;|/]*[,;|/&+][^,;|/]*(restaurant|dining|food)/i.test(p) || /(restaurant|dining|food)[^,;|/]*[,;|/&+][^,;|/]*hotel/i.test(p))) return true;
  return (input.itemCategoryNames ?? []).some((n) => !!n && DINING_RE.test(n));
}
