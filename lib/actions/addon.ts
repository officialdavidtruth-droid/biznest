"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// Add-ons are managed from the Products/Menu page, same permission as
// products/categories/variants.
async function access(slug: string) {
  return assertStorePermission(slug, "products");
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
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) return { success: false, error: "Group name must be 2–60 characters." };

  const product = await prisma.product.findFirst({ where: { id: productId, storeId: a.store.id } });
  if (!product) return { success: false, error: "Menu item not found." };

  const minSelect = Math.max(0, input.minSelect ?? 0);
  const maxSelect = input.maxSelect == null ? null : Math.max(minSelect, input.maxSelect);

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
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const group = await prisma.productAddonGroup.findFirst({ where: { id: groupId, storeId: a.store.id } });
  if (!group) return { success: false, error: "Add-on group not found." };

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 60) return { success: false, error: "Group name must be 2–60 characters." };
    data.name = name;
  }
  if (input.minSelect !== undefined) data.minSelect = Math.max(0, input.minSelect);
  if (input.maxSelect !== undefined) data.maxSelect = input.maxSelect;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.productAddonGroup.update({ where: { id: groupId }, data });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: undefined };
}

export async function deleteAddonGroup(slug: string, groupId: string): Promise<ActionResult> {
  const a = await access(slug);
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
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const group = await prisma.productAddonGroup.findFirst({ where: { id: groupId, storeId: a.store.id } });
  if (!group) return { success: false, error: "Add-on group not found." };

  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) return { success: false, error: "Add-on name must be 1–60 characters." };
  const price = Math.max(0, input.price ?? 0);

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
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const addon = await prisma.productAddon.findFirst({ where: { id: addonId, storeId: a.store.id } });
  if (!addon) return { success: false, error: "Add-on not found." };

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 60) return { success: false, error: "Add-on name must be 1–60 characters." };
    data.name = name;
  }
  if (input.price !== undefined) data.price = Math.max(0, input.price);
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.productAddon.update({ where: { id: addonId }, data });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: undefined };
}

export async function deleteAddon(slug: string, addonId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  const addon = await prisma.productAddon.findFirst({ where: { id: addonId, storeId: a.store.id } });
  if (!addon) return { success: false, error: "Add-on not found." };
  await prisma.productAddon.delete({ where: { id: addonId } });
  revalidatePath(`/store/${slug}/admin/addons`);
  return { success: true, data: undefined };
}
