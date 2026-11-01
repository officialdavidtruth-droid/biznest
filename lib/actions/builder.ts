"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { BUILDER_CONFLICT_ERROR, builderConfigSaveSchema, readBuilderConfig, type BuilderConfig } from "@/lib/builder-config";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { updateSectionOverridesJson } from "@/lib/store-overrides";
import { ARRANGEMENT_KEY, normalizeArrangement } from "@/lib/storefront/arrangement";

// Website Builder lives under "settings" in the nav (dashboard-nav.ts), so
// a MANAGER/STAFF granted "settings" should be able to actually save
// changes here too, not just view the page.
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "settings");
}

/**
 * Publishes a layout. `baseJson` is the JSON of the published layout the editor started from; when the live
 * layout has since changed (another staff member published), nothing is written and BUILDER_CONFLICT_ERROR is
 * returned so the editor can ask before overwriting. Omit it to overwrite on purpose.
 */
export async function saveBuilderConfig(slug: string, config: BuilderConfig, baseJson?: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const parsed = builderConfigSaveSchema.safeParse(config);
  if (!parsed.success) {
    // Show the specific rule that failed (the schema's own messages) instead of a generic error.
    const issue = parsed.error.issues[0];
    const path = issue?.path ?? [];
    const sectionIdx = path[0] === "sections" && typeof path[1] === "number" ? path[1] : null;
    const where = sectionIdx !== null ? `Section ${sectionIdx + 1} (${config.sections?.[sectionIdx]?.type ?? "unknown"}), ${String(path[3] ?? path[2] ?? "")}` : path.length ? String(path.join(" › ")) : "";
    return { success: false, error: `${where ? where + ": " : ""}${issue?.message ?? "Invalid website builder configuration."}` };
  }
  // Drop blank entries so Features/FAQ/Testimonials/Stats never render empty cards and Gallery never stores "" URLs.
  for (const section of parsed.data.sections) {
    const st = section.settings;
    if (st.items) st.items = st.items.filter((i) => i.title.trim());
    if (st.images) st.images = st.images.filter((u) => u.trim());
  }

  try {
    await updateSectionOverridesJson(access.store.id, (current) => {
      if (baseJson !== undefined) {
        const live = readBuilderConfig((current as { builder?: unknown }).builder);
        if (live && JSON.stringify(live) !== baseJson) throw new BuilderConflict();
      }
      return { ...current, builderVersion: 1, builder: parsed.data };
    });
  } catch (error) {
    if (error instanceof BuilderConflict) return { success: false, error: BUILDER_CONFLICT_ERROR };
    throw error;
  }

  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}

class BuilderConflict extends Error {}

/**
 * Un-publishes the visual builder: removes the saved layout so the store's template draws its own homepage again.
 * Other overrides (faq, delivery note, social bio, template content) are kept.
 */
export async function resetBuilderToTemplate(slug: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  await updateSectionOverridesJson(access.store.id, (current) => {
    const { builderVersion: _v, builder: _b, order: _o, hidden: _h, [ARRANGEMENT_KEY]: _a, ...rest } = current;
    void _v; void _b; void _o; void _h; void _a;
    return rest;
  });

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

/**
 * Saves the owner's section order / hidden sections for a template that draws its own homepage.
 * An empty arrangement removes the key, which restores the template's default layout.
 */
export async function saveTemplateArrangement(slug: string, input: { order: string[]; hidden: string[] }): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const arrangement = normalizeArrangement(input);
  const empty = arrangement.order.length === 0 && arrangement.hidden.length === 0;

  await updateSectionOverridesJson(access.store.id, (current) => {
    const { [ARRANGEMENT_KEY]: _old, ...rest } = current;
    void _old;
    return empty ? rest : { ...rest, [ARRANGEMENT_KEY]: arrangement };
  });

  revalidatePath(`/store/${slug}`);
  revalidatePath(`/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}
