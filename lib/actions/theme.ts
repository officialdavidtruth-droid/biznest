"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { normalizeTemplateColors, type TemplateColorInput } from "@/lib/theme-colors";

/**
 * Sets the accent and background colours of the store's template (used by templates that draw their own homepage,
 * where the visual builder's design controls have no effect). Saved live, like the Content panel.
 */
export async function saveTemplateColors(slug: string, colors: TemplateColorInput): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return { success: false, error: access.error };
  const cleaned = normalizeTemplateColors(colors);
  if (!cleaned.ok) return { success: false, error: cleaned.error };

  const row = await prisma.store.findUnique({ where: { id: access.store.id }, select: { themeColors: true } });
  const current = row?.themeColors && typeof row.themeColors === "object" && !Array.isArray(row.themeColors) ? (row.themeColors as Record<string, unknown>) : {};
  await prisma.store.update({ where: { id: access.store.id }, data: { themeColors: { ...current, ...cleaned.value } as Prisma.InputJsonValue } });

  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}

/** Back to the template's own colours. */
export async function resetTemplateColors(slug: string): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return { success: false, error: access.error };
  await prisma.store.update({ where: { id: access.store.id }, data: { themeColors: Prisma.DbNull } });
  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}
