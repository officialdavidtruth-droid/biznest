"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { storeBaseUrl } from "@/lib/seo";
import type { ActionResult } from "@/types/actions";

// Restaurant tables, each with its own QR code. Lives on the main dashboard
// (Reservations → Tables) for restaurant and food businesses.
async function guard(slug: string) {
  const a = await assertStorePermission(slug, "products");
  if (!a.success) return { ok: false as const, error: a.error };
  const type = getCanonicalBusinessType({ businessCategory: a.store.business?.category, storeBusinessType: a.store.businessType });
  if (!["Restaurant", "Food & Groceries"].includes(type)) return { ok: false as const, error: "Tables are available to restaurant and food businesses." };
  return { ok: true as const, store: a.store };
}

export async function getStoreTables(slug: string): Promise<ActionResult<{ baseUrl: string; tables: { id: string; name: string; seats: number | null; token: string }[] }>> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const store = await prisma.store.findUnique({ where: { id: g.store.id }, select: { slug: true, customDomain: true, customDomainStatus: true } });
  if (!store) return { success: false, error: "Store not found." };
  const tables = await prisma.fnbTable.findMany({ where: { storeId: g.store.id, active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, seats: true, token: true } });
  return { success: true, data: { baseUrl: storeBaseUrl(store), tables } };
}

export async function createStoreTables(slug: string, input: { name?: string; seats?: number | null; count?: number }): Promise<ActionResult<{ created: number }>> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const seats = input.seats && input.seats > 0 ? Math.min(Math.floor(input.seats), 99) : null;
  const names: string[] = [];
  if (input.count && input.count > 1) {
    const count = Math.min(Math.floor(input.count), 60);
    const existing = await prisma.fnbTable.count({ where: { storeId: g.store.id } });
    for (let i = 1; i <= count; i++) names.push(`Table ${existing + i}`);
  } else {
    const name = (input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name) return { success: false, error: "Give the table a name, like Table 1 or Patio 2." };
    names.push(name);
  }
  const res = await prisma.fnbTable.createMany({ data: names.map((name) => ({ storeId: g.store.id, name, seats })), skipDuplicates: true });
  if (res.count === 0) return { success: false, error: "A table with that name already exists." };
  revalidatePath(`/store/${slug}/admin/tables`);
  revalidatePath(`/store/${slug}/admin/pos`);
  return { success: true, data: { created: res.count } };
}

export async function removeStoreTable(slug: string, id: string): Promise<ActionResult<undefined>> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  await prisma.fnbTable.deleteMany({ where: { id, storeId: g.store.id } });
  revalidatePath(`/store/${slug}/admin/tables`);
  revalidatePath(`/store/${slug}/admin/pos`);
  return { success: true, data: undefined };
}
