/**
 * Plain-list helpers for Simple mode's Categories screen. Pure (no database, no React).
 * Simple mode shows only top-level categories; subcategories, pictures and icons are left
 * untouched and managed in Advanced options.
 */
export type CategoryInput = {
  id: string;
  name: string;
  type: "PRODUCT" | "SERVICE";
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type SimpleCategoryRow = {
  id: string;
  name: string;
  type: "PRODUCT" | "SERVICE";
  isActive: boolean;
  itemCount: number;
  subcategoryCount: number;
};

/**
 * Top-level categories in the same order the storefront and the reorder action use
 * (sortOrder, then name), so the arrows on screen always match what customers see.
 */
export function topLevelRows(categories: CategoryInput[], itemCounts: Record<string, number>): SimpleCategoryRow[] {
  return categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      isActive: c.isActive,
      itemCount: itemCounts[c.id] ?? 0,
      subcategoryCount: categories.filter((x) => x.parentId === c.id).length,
    }));
}

/** Why a category can't be deleted yet, in plain words, or null when it can. */
export function deleteBlockReason(row: Pick<SimpleCategoryRow, "itemCount" | "subcategoryCount">): string | null {
  if (row.itemCount > 0) {
    return `This has ${row.itemCount} ${row.itemCount === 1 ? "item" : "items"} in it. Move ${row.itemCount === 1 ? "it" : "them"} to another category first.`;
  }
  if (row.subcategoryCount > 0) return "This has subcategories. Remove them first in Advanced options.";
  return null;
}

/** "Category" -> "Categories", keeping words like "Menu Category" intact. */
export function pluralize(word: string): string {
  return /y$/i.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`;
}
