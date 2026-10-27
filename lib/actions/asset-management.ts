"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import type { ActionResult } from "@/types/actions";

const KEY = "asset-management";

async function guard(slug: string) {
  const a = await assertStorePermission(slug, `plugin:${KEY}`);
  if (!a.success) return { ok: false as const, error: a.error };
  const e = await getPluginEntitlement(a.store.id, KEY);
  if (!e.allowed || !e.installed) return { ok: false as const, error: e.reason ?? "Install this app first." };
  return { ok: true as const, store: a.store };
}

export type AssetRow = {
  id: string;
  assetNo: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  usefulLifeMonths: number;
  residualValue: number;
  accumulatedDepreciation: number;
  status: string;
  notes: string | null;
};

const done = (slug: string) => revalidatePath(`/store/${slug}/admin/apps/${KEY}`);

export async function getAssetWorkspace(slug: string) {
  const g = await guard(slug);
  if (!g.ok) return { error: g.error };
  const rows = await prisma.financialAsset.findMany({ where: { storeId: g.store.id }, orderBy: { createdAt: "desc" }, take: 300 });
  const assets: AssetRow[] = rows.map((a) => ({
    id: a.id, assetNo: a.assetNo, name: a.name, category: a.category,
    purchaseDate: a.purchaseDate.toISOString(), purchaseCost: Number(a.purchaseCost), usefulLifeMonths: a.usefulLifeMonths,
    residualValue: Number(a.residualValue), accumulatedDepreciation: Number(a.accumulatedDepreciation), status: a.status, notes: a.notes,
  }));
  return { currency: g.store.currency, locale: g.store.locale ?? null, assets };
}

export async function addAsset(slug: string, input: { name: string; category: string; purchaseDate: string; purchaseCost: number; usefulLifeMonths: number; residualValue?: number; notes?: string }): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const name = input.name.trim();
  const category = input.category.trim();
  const purchaseDate = new Date(`${input.purchaseDate}T00:00:00.000Z`);
  if (!name) return { success: false, error: "Give the asset a name." };
  if (!category) return { success: false, error: "Choose a category." };
  if (Number.isNaN(purchaseDate.getTime())) return { success: false, error: "Enter a valid purchase date." };
  if (!Number.isFinite(input.purchaseCost) || input.purchaseCost <= 0) return { success: false, error: "Purchase cost must be above zero." };
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0 || input.usefulLifeMonths > 600) return { success: false, error: "Useful life must be a whole number of months (1 to 600)." };
  const residual = input.residualValue ?? 0;
  if (!Number.isFinite(residual) || residual < 0 || residual >= input.purchaseCost) return { success: false, error: "Residual value must be lower than the purchase cost." };
  await prisma.financialAsset.create({
    data: { storeId: g.store.id, assetNo: `BN-AST-${Date.now()}-${nanoid(5).toUpperCase()}`, name, category, purchaseDate, purchaseCost: input.purchaseCost, usefulLifeMonths: input.usefulLifeMonths, residualValue: residual, notes: input.notes?.trim() || null },
  });
  done(slug);
  return { success: true, data: undefined };
}

export async function depreciateAsset(slug: string, id: string, months: number): Promise<ActionResult<{ amount: number }>> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  if (!Number.isInteger(months) || months <= 0 || months > 120) return { success: false, error: "Choose between 1 and 120 months." };
  const asset = await prisma.financialAsset.findFirst({ where: { id, storeId: g.store.id, status: "ACTIVE" } });
  if (!asset) return { success: false, error: "Asset not found or no longer active." };
  const depreciable = Number(asset.purchaseCost) - Number(asset.residualValue);
  const remaining = depreciable - Number(asset.accumulatedDepreciation);
  if (remaining <= 0) return { success: false, error: "This asset is already fully depreciated." };
  const amount = Math.min(remaining, (depreciable / asset.usefulLifeMonths) * months);
  const fully = Number(asset.accumulatedDepreciation) + amount >= depreciable - 0.005;
  await prisma.financialAsset.update({ where: { id: asset.id }, data: { accumulatedDepreciation: { increment: amount }, status: fully ? "FULLY_DEPRECIATED" : "ACTIVE" } });
  done(slug);
  return { success: true, data: { amount } };
}

export async function addMaintenanceNote(slug: string, id: string, note: string): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const text = note.trim();
  if (!text) return { success: false, error: "Write what was done." };
  const asset = await prisma.financialAsset.findFirst({ where: { id, storeId: g.store.id }, select: { id: true, notes: true } });
  if (!asset) return { success: false, error: "Asset not found." };
  const line = `[${new Date().toISOString().slice(0, 10)}] ${text.replace(/\s*\n\s*/g, " ").slice(0, 500)}`;
  const next = asset.notes ? `${asset.notes}\n${line}` : line;
  if (next.length > 8000) return { success: false, error: "This asset's log is full. Remove old entries first." };
  await prisma.financialAsset.update({ where: { id: asset.id }, data: { notes: next } });
  done(slug);
  return { success: true, data: undefined };
}

export async function disposeAsset(slug: string, id: string): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const r = await prisma.financialAsset.updateMany({ where: { id, storeId: g.store.id, status: { not: "DISPOSED" } }, data: { status: "DISPOSED" } });
  if (!r.count) return { success: false, error: "Asset not found or already disposed." };
  done(slug);
  return { success: true, data: undefined };
}

export async function deleteAsset(slug: string, id: string): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.ok) return { success: false, error: g.error };
  const r = await prisma.financialAsset.deleteMany({ where: { id, storeId: g.store.id, accumulatedDepreciation: 0 } });
  if (!r.count) return { success: false, error: "Only assets with no depreciation recorded can be deleted. Dispose of it instead." };
  done(slug);
  return { success: true, data: undefined };
}
