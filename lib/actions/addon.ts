"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { roundMoney } from "@/lib/utils/pricing";

const MAX_ADDON_PRICE = 999_999_999; // column is Decimal(12,2)
const MAX_SELECT = 100;

/** A valid add-on price (0 = free) rounded to 2dp, or null when the number is unusable. */
function cleanAddonPrice(v: number | undefined): number | null {
  const n = v ?? 0;
  if (!Number.isFinite(n) || n < 0 || n > MAX_ADDON_PRICE) return null;
  return roundMoney(n);
}

function cleanSelectCount(v: number): number | null {
  return Number.isInteger(v) && v >= 0 && v <= MAX_SELECT ? v : null;
}

// Add-ons are managed from the Products/Menu page, same permission as
// products/categories/variants.
async function access(slug: string) {
  return assertStorePermission(slug, "products");
}

async function assertMenuEditor(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return a;
  if (a.role === "STAFF") return { success: false as const, error: "Staff can view the menu but cannot edit menu items, categories, variants or add-ons." };
  return a;
}

export async function listAddonGroupsForProduct(slug: string, productId: string) {
  const a = await access(slug);
  if (!a.success) return [];
  return prisma.productAddonGroup.findMany({
    where: { productId, storeId: a.store.id },
    include: { addons: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createAddonGroup(
  slug: string,
  productId: string,
  input: { name: string; minSelect?: number; maxSelect?: number | null }
): Promise<ActionResult<{ id: string }>> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) return { success: false, error: "Group name must be 2–60 characters." };

  const product = await prisma.product.findFirst({ where: { id: productId, storeId: a.store.id } });
  if (!product) return { success: false, error: "Menu item not found." };

  const minSelect = cleanSelectCount(input.minSelect ?? 0);
  if (minSelect == null) return { success: false, error: `Minimum choices must be a whole number from 0 to ${MAX_SELECT}.` };
  let maxSelect: number | null = null;
  if (input.maxSelect != null) {
    const m = cleanSelectCount(input.maxSelect);
    if (m == null) return { success: false, error: `Maximum choices must be a whole number from 0 to ${MAX_SELECT}.` };
    if (m < minSelect) return { success: false, error: "Maximum choices can't be lower than the minimum." };
    maxSelect = m;
  }

  const row = await prisma.productAddonGroup.create({
    data: { productId, storeId: a.store.id, name, minSelect, maxSelect },
  });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: { id: row.id } };
}

export async function updateAddonGroup(
  slug: string,
  groupId: string,
  input: { name?: string; minSelect?: number; maxSelect?: number | null; isActive?: boolean }
): Promise<ActionResult> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const group = await prisma.productAddonGroup.findFirst({ where: { id: groupId, storeId: a.store.id } });
  if (!group) return { success: false, error: "Add-on group not found." };

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) return { success: false, error: "Group name must be 2–60 characters." };
    data.name = name;
  }
  // Validate against the values the group will end up with, so a lone edit can't leave
  // max below min (a group no shopper could ever satisfy at checkout).
  const nextMin = input.minSelect !== undefined ? cleanSelectCount(input.minSelect) : group.minSelect;
  if (nextMin == null) return { success: false, error: `Minimum choices must be a whole number from 0 to ${MAX_SELECT}.` };
  let nextMax: number | null = group.maxSelect;
  if (input.maxSelect !== undefined) {
    if (input.maxSelect === null) nextMax = null;
    else {
      const m = cleanSelectCount(input.maxSelect);
      if (m == null) return { success: false, error: `Maximum choices must be a whole number from 0 to ${MAX_SELECT}.` };
      nextMax = m;
    }
  }
  if (nextMax != null && nextMax < nextMin) return { success: false, error: "Maximum choices can't be lower than the minimum." };
  if (input.minSelect !== undefined) data.minSelect = nextMin;
  if (input.maxSelect !== undefined) data.maxSelect = nextMax;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.productAddonGroup.update({ where: { id: groupId }, data });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: undefined };
}

export async function deleteAddonGroup(slug: string, groupId: string): Promise<ActionResult> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const group = await prisma.productAddonGroup.findFirst({ where: { id: groupId, storeId: a.store.id } });
  if (!group) return { success: false, error: "Add-on group not found." };
  await prisma.productAddonGroup.delete({ where: { id: groupId } });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: undefined };
}

export async function createAddon(
  slug: string,
  groupId: string,
  input: { name: string; price?: number }
): Promise<ActionResult<{ id: string }>> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const group = await prisma.productAddonGroup.findFirst({ where: { id: groupId, storeId: a.store.id } });
  if (!group) return { success: false, error: "Add-on group not found." };

  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) return { success: false, error: "Add-on name must be 1–60 characters." };
  const price = cleanAddonPrice(input.price);
  if (price == null) return { success: false, error: "Enter a valid price (0 or more)." };

  const row = await prisma.productAddon.create({
    data: { groupId, storeId: a.store.id, name, price },
  });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: { id: row.id } };
}

export async function updateAddon(
  slug: string,
  addonId: string,
  input: { name?: string; price?: number; isActive?: boolean }
): Promise<ActionResult> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const addon = await prisma.productAddon.findFirst({ where: { id: addonId, storeId: a.store.id } });
  if (!addon) return { success: false, error: "Add-on not found." };

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 60) return { success: false, error: "Add-on name must be 1–60 characters." };
    data.name = name;
  }
  if (input.price !== undefined) {
    const price = cleanAddonPrice(input.price);
    if (price == null) return { success: false, error: "Enter a valid price (0 or more)." };
    data.price = price;
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.productAddon.update({ where: { id: addonId }, data });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: undefined };
}

export async function deleteAddon(slug: string, addonId: string): Promise<ActionResult> {
  const a = await assertMenuEditor(slug);
  if (!a.success) return { success: false, error: a.error };
  const addon = await prisma.productAddon.findFirst({ where: { id: addonId, storeId: a.store.id } });
  if (!addon) return { success: false, error: "Add-on not found." };
  await prisma.productAddon.delete({ where: { id: addonId } });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: undefined };
}
