"use server";

import { prisma } from "@/lib/prisma";
import { financialAccess } from "@/lib/financial/access";
import type { ActionResult } from "@/types/actions";

const MAX_CELLS = 5000;
const MAX_CELL_LENGTH = 500;

function cleanCells(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object") return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[A-Z]{1,2}[1-9][0-9]{0,3}$/.test(key)) continue;
    const text = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
    if (text === "") continue;
    out[key] = text.slice(0, MAX_CELL_LENGTH);
  }
  return Object.keys(out).length > MAX_CELLS ? null : out;
}

export async function listFinancialSheets(slug: string): Promise<ActionResult<{ id: string; name: string; updatedAt: string; cells: Record<string, string> }[]>> {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const rows = await prisma.financialSheet.findMany({ where: { storeId: a.store.id }, orderBy: { updatedAt: "desc" }, take: 50 });
  return { success: true, data: rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt.toISOString(), cells: (r.cells ?? {}) as Record<string, string> })) };
}

export async function saveFinancialSheet(slug: string, input: { id?: string; name: string; cells: Record<string, string> }): Promise<ActionResult<{ id: string; updatedAt: string }>> {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const name = input.name.trim().slice(0, 80) || "Untitled sheet";
  const cells = cleanCells(input.cells);
  if (!cells) return { success: false, error: "This sheet is too large to save." };
  if (input.id) {
    const found = await prisma.financialSheet.findFirst({ where: { id: input.id, storeId: a.store.id }, select: { id: true } });
    if (!found) return { success: false, error: "Sheet not found." };
    const row = await prisma.financialSheet.update({ where: { id: found.id }, data: { name, cells } });
    return { success: true, data: { id: row.id, updatedAt: row.updatedAt.toISOString() } };
  }
  const count = await prisma.financialSheet.count({ where: { storeId: a.store.id } });
  if (count >= 50) return { success: false, error: "You can keep up to 50 sheets. Delete one first." };
  const row = await prisma.financialSheet.create({ data: { storeId: a.store.id, name, cells } });
  return { success: true, data: { id: row.id, updatedAt: row.updatedAt.toISOString() } };
}

export async function deleteFinancialSheet(slug: string, id: string): Promise<ActionResult> {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const res = await prisma.financialSheet.deleteMany({ where: { id, storeId: a.store.id } });
  return res.count ? { success: true, data: undefined } : { success: false, error: "Sheet not found." };
}
