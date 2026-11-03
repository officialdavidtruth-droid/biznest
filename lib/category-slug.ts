// Category URL slugs (WordPress-style): /store/[store]/category/[category-slug].
// Pure helpers first (unit-tested), then one DB helper used by every place that creates a category.

const MAX_LEN = 60;

/** "Men's Shoes & Bags" -> "mens-shoes-and-bags". Never returns an empty string. */
export function slugifyCategory(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents: "Café" -> "Cafe"
    .toLowerCase()
    .replace(/['’`]/g, "") // "men's" -> "mens", not "men-s"
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN)
    .replace(/-+$/g, "");
  return s || "category";
}

/** Returns `base`, or base-2, base-3 ... — the first one not in `taken`. */
export function pickUniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10000; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, MAX_LEN - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, MAX_LEN - 7)}-${Date.now().toString(36).slice(-6)}`;
}

/** The URL segment for a category: its slug, or the id for a row that has no slug yet. */
export function categorySegment(c: { id: string; slug?: string | null }): string {
  return c.slug || c.id;
}

/** `/store/<store>/category/<segment>` */
export function categoryHref(storeSlug: string, c: { id: string; slug?: string | null }): string {
  return `/store/${storeSlug}/category/${categorySegment(c)}`;
}

/** Validates an owner-typed slug. Returns the cleaned slug, or null if it is not usable. */
export function cleanCategorySlug(raw: string): string | null {
  // slugifyCategory falls back to "category" for junk; for an address the owner typed on purpose, reject it instead.
  if (!/[a-z0-9]/i.test(raw.normalize("NFKD"))) return null;
  return slugifyCategory(raw);
}

// Minimal structural type so this works with both `prisma` and a `tx` from prisma.$transaction.
type SlugDb = { category: { findMany(args: { where: { storeId: string; slug: { startsWith: string }; NOT?: { id: string } }; select: { slug: true } }): Promise<{ slug: string | null }[]> } };

/** A slug for `name` that no other category in this store is using. Pass `excludeId` when renaming/editing one. */
export async function uniqueCategorySlug(db: SlugDb, storeId: string, name: string, excludeId?: string): Promise<string> {
  const base = slugifyCategory(name);
  const rows = await db.category.findMany({
    where: { storeId, slug: { startsWith: base }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { slug: true },
  });
  return pickUniqueSlug(base, new Set(rows.map((r) => r.slug).filter((s): s is string => !!s)));
}
