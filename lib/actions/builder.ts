"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { builderConfigSchema, type BuilderConfig } from "@/lib/builder-config";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// Website Builder lives under "settings" in the nav (dashboard-nav.ts), so
// a MANAGER/STAFF granted "settings" should be able to actually save
// changes here too, not just view the page.
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "settings");
}

export async function saveBuilderConfig(slug: string, config: BuilderConfig): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const parsed = builderConfigSchema.safeParse(config);
  if (!parsed.success) return { success: false, error: "Invalid website builder configuration." };

  const current = (access.store.sectionOverrides as Record<string, unknown> | null) ?? {};
  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      sectionOverrides: {
        ...current,
        builderVersion: 1,
        builder: parsed.data,
        order: parsed.data.sections.map((s) => s.id),
        hidden: parsed.data.sections.filter((s) => !s.visible).map((s) => s.id),
      },
    },
  });

  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}

/**
 * Un-publishes the visual builder: removes the saved layout so the store's template draws its own homepage again.
 * Other overrides (faq, delivery note, social bio, template content) are kept.
 */
export async function resetBuilderToTemplate(slug: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const current = access.store.sectionOverrides;
  if (current && typeof current === "object" && !Array.isArray(current)) {
    const { builderVersion: _v, builder: _b, order: _o, hidden: _h, ...rest } = current as Record<string, unknown>;
    void _v; void _b; void _o; void _h;
    await prisma.store.update({ where: { id: access.store.id }, data: { sectionOverrides: rest as Prisma.InputJsonValue } });
  }

  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}

export async function activateVisualBuilder(slug: string, config: BuilderConfig): Promise<ActionResult> {
  return saveBuilderConfig(slug, config);
}

export async function updateStoreSeo(slug: string, seoTitle: string, seoDescription: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const title = seoTitle.trim().slice(0, 70);
  const description = seoDescription.trim().slice(0, 160);
  if (!title) return { success: false, error: "SEO title is required." };
  await prisma.store.update({ where: { id: access.store.id }, data: { seoTitle: title, seoDescription: description || null } });
  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}
