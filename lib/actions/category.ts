"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  return assertStorePermission(slug, "products");
}

async function assertMenuEditor(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return a;
  if (a.role === "STAFF") return { success: false as const, error: "Staff can view the menu but cannot edit menu items, categories, variants or add-ons." };
  return a;
}

/** Shared field checks so unvalidated URLs/long text can't be stored. Returns an error message or null. */
function checkCategoryFields(input: { imageUrl?: string | null; icon?: string | null; description?: string | null }): string | null {
  const img = input.imageUrl?.trim();
  if (img && !/^https:\/\/\S+$/i.test(img)) return "Image link must start with https://";
  if (img && img.length > 2000) return "Image link is too long.";
  if ((input.icon?.trim().length ?? 0) > 40) return "Icon name is too long.";
  if ((input.description?.trim().length ?? 0) > 500) return "Keep the description under 500 characters.";
  return null;
}

export async function getStoreCategories(slug: string) {
  const a = await access(slug);
  if (!a.success) return [];
  return prisma.category.findMany({
    where: { storeId: a.store.id },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    select: { id: true, storeId: true, name: true, description: true, type: true, parentId: true, sortOrder: true, isActive: true, imageUrl: true, icon: true, createdAt: true, updatedAt: true },
  });
}

export async function getCategoryItemCounts(slug: string): Promise<Record<string, number>> {
  const a = await access(slug);
  if (!a.success) return {};
  const [products, services] = await Promise.all([
    prisma.product.groupBy({ by: ["categoryId"], where: { storeId: a.store.id, categoryId: { not: null } }, _count: { _all: true } }),
    prisma.service.groupBy({ by: ["categoryId"], where: { storeId: a.store.id, categoryId: { not: null } }, _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = {};
  for (const row of [...products, ...services]) {
    if (!row.categoryId) continue;
    counts[row.categoryId] = (counts[row.categoryId] ?? 0) + row._count._all;
  }
  return counts;
}

export async function createCategory(slug: string, input: { name: string; type: "PRODUCT" | "SERVICE"; parentId?: string | null; imageUrl?: string | null; icon?: string | null; description?: string | null }): Promise<ActionResult<{ id: string }>> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return { success: false, error: "Category name must be 2–80 characters." };
  const fieldError = checkCategoryFields(input);
  if (fieldError) return { success: false, error: fieldError };
  if (input.parentId) {
    const parent = await prisma.category.findFirst({ where: { id: input.parentId, storeId: a.store.id } });
    if (!parent) return { success: false, error: "Parent category not found." };
    if (parent.type !== input.type) return { success: false, error: "Category type must match its parent." };
  }
  const duplicate = await prisma.category.findFirst({ where: { storeId: a.store.id, name, parentId: input.parentId ?? null } });
  if (duplicate) return { success: false, error: "A category with this name already exists here." };
  const row = await prisma.category.create({ data: { storeId: a.store.id, name, type: input.type, parentId: input.parentId ?? null, imageUrl: input.imageUrl?.trim() || null, icon: input.icon?.trim() || null, description: input.description?.trim() || null } });
  revalidatePath(`/store/${slug}/admin/categories`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: { id: row.id } };
}

export async function updateCategory(slug: string, id: string, input: { name: string; parentId?: string | null; imageUrl?: string | null; icon?: string | null; isActive?: boolean; description?: string | null }): Promise<ActionResult> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const row = await prisma.category.findFirst({ where: { id, storeId: a.store.id } });
  if (!row) return { success: false, error: "Category not found." };
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return { success: false, error: "Category name must be 2–80 characters." };
  const fieldError = checkCategoryFields(input);
  if (fieldError) return { success: false, error: fieldError };
  if (input.parentId === id) return { success: false, error: "A category cannot be its own parent." };
  if (input.parentId) {
    const parent = await prisma.category.findFirst({ where: { id: input.parentId, storeId: a.store.id } });
    if (!parent || parent.type !== row.type) return { success: false, error: "Invalid parent category." };
    let cursor: string | null = input.parentId;
    while (cursor) {
      if (cursor === id) return { success: false, error: "That parent would create a category cycle." };
      const next: { parentId: string | null } | null = await prisma.category.findFirst({ where: { id: cursor, storeId: a.store.id }, select: { parentId: true } });
      cursor = next?.parentId ?? null;
    }
  }
  const duplicate = await prisma.category.findFirst({ where: { storeId: a.store.id, name, parentId: input.parentId ?? null, NOT: { id } } });
  if (duplicate) return { success: false, error: "A category with this name already exists here." };
  await prisma.category.update({ where: { id }, data: { name, parentId: input.parentId ?? null, imageUrl: input.imageUrl?.trim() || null, icon: input.icon?.trim() || null, ...(input.description === undefined ? {} : { description: input.description?.trim() || null }), ...(input.isActive === undefined ? {} : { isActive: input.isActive }) } });
  revalidatePath(`/store/${slug}/admin/categories`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

export async function deleteCategory(slug: string, id: string): Promise<ActionResult> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const row = await prisma.category.findFirst({ where: { id, storeId: a.store.id }, include: { children: true } });
  if (!row) return { success: false, error: "Category not found." };
  const [products, services] = await Promise.all([
    prisma.product.count({ where: { storeId: a.store.id, categoryId: id } }),
    prisma.service.count({ where: { storeId: a.store.id, categoryId: id } }),
  ]);
  if (products || services) return { success: false, error: "Move or uncategorize its listings before deleting this category." };
  if (row.children.length) return { success: false, error: "Delete or move its subcategories first." };
  await prisma.category.delete({ where: { id } });
  revalidatePath(`/store/${slug}/admin/categories`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

export async function setCategoryActive(slug: string, id: string, isActive: boolean): Promise<ActionResult> {
  const a = await assertMenuEditor(slug); if (!a.success) return { success: false, error: a.error };
  const row = await prisma.category.findFirst({ where: { id, storeId: a.store.id } });
  if (!row) return { success: false, error: "Category not found." };
  await prisma.category.update({ where: { id }, data: { isActive } });
  revalidatePath(`/store/${slug}/admin/categories`); revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

export async function reorderCategory(slug: string, id: string, direction: "up" | "down"): Promise<ActionResult> {
  const a = await assertMenuEditor(slug); if (!a.success) return { success: false, error: a.error };
  const row = await prisma.category.findFirst({ where: { id, storeId: a.store.id } });
  if (!row) return { success: false, error: "Category not found." };
  const siblings = await prisma.category.findMany({ where: { storeId: a.store.id, parentId: row.parentId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const index = siblings.findIndex(x => x.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) return { success: true, data: undefined };
  // Swap in the list, then renumber every sibling 0..n-1. Swapping two raw
  // sortOrder values breaks when siblings share the default 0.
  const ordered = [...siblings];
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  await prisma.$transaction(ordered.map((c, i) => prisma.category.update({ where: { id: c.id }, data: { sortOrder: i } })));
  revalidatePath(`/store/${slug}/admin/categories`); revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
        }
