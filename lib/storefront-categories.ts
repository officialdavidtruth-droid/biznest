import { prisma } from "@/lib/prisma";

export type CategoryNode = { id: string; name: string; count: number };
export type CategoryTreeNode = CategoryNode & { children: CategoryNode[] };

/**
 * Builds a two-level category tree (top-level categories + their
 * subcategories, e.g. Fashion -> Men's Clothing, Women's Shoes, Jewelry...)
 * for one store, with real item counts at every level. A top-level
 * category's count includes its own items plus all of its subcategories'
 * items, since clicking the parent chip shows everything underneath it.
 *
 * Used by the category nav on every template's homepage, and by the
 * category/catalog pages to know which chips to render.
 */
export async function getStoreCategoryTree(storeId: string): Promise<CategoryTreeNode[]> {
  const activeCategories = await prisma.category.findMany({ where: { storeId, isActive: true }, select: { id: true } });
  const activeIds = new Set(activeCategories.map(c => c.id));

  const [products, services] = await Promise.all([
    prisma.product.findMany({
      where: { storeId, isPublished: true, categoryId: { not: null } },
      select: { categoryId: true, category: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } } },
    }),
    prisma.service.findMany({
      where: { storeId, isPublished: true, categoryId: { not: null } },
      select: { categoryId: true, category: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } } },
    }),
  ]);

  const items = [...products, ...services].map((i) => i.category).filter((c): c is NonNullable<typeof c> => !!c && activeIds.has(c.id) && (!c.parentId || activeIds.has(c.parentId)));

  const topLevel = new Map<string, CategoryTreeNode>();

  for (const cat of items) {
    if (cat.parentId && cat.parent) {
      // This item's category is a subcategory — count it under both the
      // subcategory itself and its parent.
      const parent: CategoryTreeNode = topLevel.get(cat.parentId) ?? { id: cat.parent.id, name: cat.parent.name, count: 0, children: [] };
      parent.count += 1;
      let child = parent.children.find((c) => c.id === cat.id);
      if (!child) {
        child = { id: cat.id, name: cat.name, count: 0 };
        parent.children.push(child);
      }
      child.count += 1;
      topLevel.set(cat.parentId, parent);
    } else {
      // Top-level category with no parent.
      const node: CategoryTreeNode = topLevel.get(cat.id) ?? { id: cat.id, name: cat.name, count: 0, children: [] };
      node.count += 1;
      topLevel.set(cat.id, node);
    }
  }

  return Array.from(topLevel.values())
    .map((n) => ({ ...n, children: n.children.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.count - a.count);
}

/** Flattens the tree back into a simple id->{name,parentName} lookup for breadcrumbs. */
export async function getCategoryWithParent(categoryId: string) {
  return prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: true, children: true },
  });
}
