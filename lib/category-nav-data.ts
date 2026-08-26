import { prisma } from "@/lib/prisma";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

/**
 * Given a Map of categoryId -> item count (from a store's published
 * products/services grouped by categoryId), resolves the full category
 * rows, nests subcategories under their parent, and sorts by usage. Used by
 * every storefront template's homepage plus the /catalog and /category
 * pages, so the nav bar behaves the same everywhere.
 */
export async function buildCategoryNav(categoryIdCounts: Map<string, number>, storeId?: string): Promise<CategoryTreeNode[]> {
  if (categoryIdCounts.size === 0) return [];

  const rows = await prisma.category.findMany({
    where: { id: { in: [...categoryIdCounts.keys()] }, isActive: true, ...(storeId ? { storeId } : {}) },
  });

  // A subcategory in use (e.g. "Men's Shoes") should surface its parent
  // ("Fashion") in the nav too, even if no product is directly tagged with
  // the parent category itself.
  const parentIds = rows.map((r) => r.parentId).filter((id): id is string => !!id);
  const missingParents = parentIds.filter((id) => !rows.some((r) => r.id === id));
  const parentRows = missingParents.length
    ? await prisma.category.findMany({ where: { id: { in: missingParents }, isActive: true, ...(storeId ? { storeId } : {}) } })
    : [];
  const allRows = [...rows, ...parentRows];

  const topLevel = allRows.filter((r) => !r.parentId);
  const byParent = new Map<string, typeof allRows>();
  for (const r of allRows) {
    if (!r.parentId) continue;
    if (!byParent.has(r.parentId)) byParent.set(r.parentId, []);
    byParent.get(r.parentId)!.push(r);
  }

  return topLevel
    .map((c) => {
      const children = (byParent.get(c.id) ?? []).map((sub) => ({ id: sub.id, name: sub.name, count: categoryIdCounts.get(sub.id) ?? 0 }));
      const childCount = children.reduce((sum, sub) => sum + (categoryIdCounts.get(sub.id) ?? 0), 0);
      return {
        id: c.id,
        name: c.name,
        count: (categoryIdCounts.get(c.id) ?? 0) + childCount,
        children,
      };
    })
    .sort((a, b) => b.count - a.count);
}
