"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type StoreCategory = { id: string; name: string; parentId: string | null; count: number; description?: string | null; imageUrl?: string | null };
export type CategoryNode = StoreCategory & { total: number; children: StoreCategory[] };

// null = no provider (e.g. the public template-preview route), which falls back
// to a demo list. A provider with [] means a real store with no categories.
const Ctx = createContext<StoreCategory[] | null>(null);

const DEMO: StoreCategory[] = [
  { id: "d1", name: "Electronics", parentId: null, count: 0 },
  { id: "d1a", name: "Phones & Tablets", parentId: "d1", count: 12 },
  { id: "d1b", name: "Audio", parentId: "d1", count: 9 },
  { id: "d1c", name: "Computers & Laptops", parentId: "d1", count: 7 },
  { id: "d2", name: "Fashion", parentId: null, count: 0 },
  { id: "d2a", name: "Men", parentId: "d2", count: 14 },
  { id: "d2b", name: "Women", parentId: "d2", count: 18 },
  { id: "d3", name: "Home & Living", parentId: null, count: 11 },
];

/** Supplies the store's real, active categories (with published item counts). */
export function StoreCategoriesProvider({ categories, children }: { categories: StoreCategory[]; children: ReactNode }) {
  return <Ctx.Provider value={categories}>{children}</Ctx.Provider>;
}

export function useStoreCategories(): StoreCategory[] {
  return useContext(Ctx) ?? DEMO;
}

export function buildCategoryTree(list: StoreCategory[]): CategoryNode[] {
  const ids = new Set(list.map((c) => c.id));
  // A category whose parent is inactive/missing is treated as top-level so it never disappears.
  const tops = list.filter((c) => !c.parentId || !ids.has(c.parentId));
  return tops.map((t) => {
    const children = list.filter((c) => c.parentId === t.id);
    return { ...t, children, total: t.count + children.reduce((n, c) => n + c.count, 0) };
  });
}

export function useCategoryTree(): CategoryNode[] {
  const list = useStoreCategories();
  return useMemo(() => buildCategoryTree(list), [list]);
}

/** Names matching a ?category= value: the category itself plus its sub-categories. */
export function categoryNamesFor(list: StoreCategory[], name: string): string[] {
  const key = name.trim().toLowerCase();
  const hit = list.find((c) => c.name.toLowerCase() === key);
  if (!hit) return [name];
  return [hit.name, ...list.filter((c) => c.parentId === hit.id).map((c) => c.name)];
}
