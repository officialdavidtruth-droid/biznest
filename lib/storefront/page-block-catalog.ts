import { prisma } from "@/lib/prisma";
import type { CollectionSort, PageBlock } from "@/lib/storefront/page-blocks";

/** One product as a page block shows it. Read from the catalogue each time the page renders. */
export type CatalogCard = { id: string; name: string; image: string | null; price: number; compareAt: number | null; currency: string };

/** The cards for every products/collection block on a page, keyed by block id. */
export type BlockCatalog = Record<string, CatalogCard[]>;

type Row = { id: string; name: string; images: string[]; price: unknown; compareAtPrice: unknown; currency: string };

const toCard = (r: Row): CatalogCard => {
  const price = Number(r.price);
  const compare = r.compareAtPrice == null ? null : Number(r.compareAtPrice);
  return {
    id: r.id,
    name: r.name,
    image: r.images?.[0] ?? null,
    price: Number.isFinite(price) ? price : 0,
    compareAt: compare !== null && Number.isFinite(compare) && compare > price ? compare : null,
    currency: r.currency || "NGN",
  };
};

/** Keeps the owner's chosen order and silently skips products that are gone, hidden or unpublished. */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as T] : []));
}

export function collectionOrderBy(sort: CollectionSort) {
  if (sort === "price-asc") return [{ price: "asc" as const }, { createdAt: "desc" as const }];
  if (sort === "price-desc") return [{ price: "desc" as const }, { createdAt: "desc" as const }];
  return [{ createdAt: "desc" as const }];
}

const SELECT = { id: true, name: true, images: true, price: true, compareAtPrice: true, currency: true } as const;

/**
 * Looks up the products for a page's catalogue blocks. Every query is scoped to this store and to published,
 * non-archived products, so a block can never show another store's product or a hidden one. Never throws: when the
 * lookup fails the blocks simply show nothing.
 */
export async function resolveBlockCatalog(storeId: string, blocks: PageBlock[]): Promise<BlockCatalog> {
  const out: BlockCatalog = {};
  const live = { storeId, isPublished: true, archivedAt: null } as const;
  try {
    const picked = blocks.filter((b): b is Extract<PageBlock, { type: "products" }> => b.type === "products");
    const collections = blocks.filter((b): b is Extract<PageBlock, { type: "collection" }> => b.type === "collection");

    if (picked.length) {
      const ids = Array.from(new Set(picked.flatMap((b) => b.productIds)));
      const rows = await prisma.product.findMany({ where: { ...live, id: { in: ids } }, select: SELECT });
      for (const b of picked) out[b.id] = orderByIds(rows, b.productIds).map(toCard);
    }

    if (collections.length) {
      // A category includes its sub-categories, the same way the shop's category pages count them.
      const needsTree = collections.some((b) => b.categoryId);
      const cats = needsTree ? await prisma.category.findMany({ where: { storeId, isActive: true }, select: { id: true, parentId: true } }) : [];
      await Promise.all(collections.map(async (b) => {
        const categoryIds = b.categoryId ? [b.categoryId, ...cats.filter((c) => c.parentId === b.categoryId).map((c) => c.id)] : null;
        const rows = await prisma.product.findMany({
          where: { ...live, ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) },
          orderBy: collectionOrderBy(b.sort),
          take: b.limit,
          select: SELECT,
        });
        out[b.id] = rows.map(toCard);
      }));
    }
  } catch {
    return {};
  }
  return out;
}

/** Everything the page editor's pickers need. Kept small: id, name, photo and price only. */
export type CatalogOptions = {
  products: { id: string; name: string; image: string | null; price: number; currency: string }[];
  categories: { id: string; name: string }[];
};

export async function loadCatalogOptions(storeId: string): Promise<CatalogOptions> {
  try {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({ where: { storeId, isPublished: true, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 300, select: { id: true, name: true, images: true, price: true, currency: true } }),
      prisma.category.findMany({ where: { storeId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    ]);
    return {
      products: products.map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, price: Number(p.price), currency: p.currency || "NGN" })),
      categories,
    };
  } catch {
    return { products: [], categories: [] };
  }
}
