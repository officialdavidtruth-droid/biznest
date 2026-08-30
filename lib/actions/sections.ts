"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { Section } from "@/lib/template-themes";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";

const ALL_SECTIONS: Section[] = ["hero", "catalog", "about", "stats", "testimonials", "newsletter", "contact"];

// Section ordering lives under the website builder/customize area
// ("settings" permission in dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "settings");
}

/**
 * formData carries the full section order as repeated "order" fields (in
 * the order the vendor arranged them) and one "hidden" checkbox per
 * optional section. "hero" is never included as a checkbox — it can't be
 * turned off — so it's always kept, always first.
 */
export async function updateSectionOverrides(slug: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const order = formData.getAll("order").map(String).filter((s): s is Section => ALL_SECTIONS.includes(s as Section));
  const hidden = ALL_SECTIONS.filter((s) => s !== "hero" && formData.get(`hidden-${s}`) === "on");

  // De-dupe and guarantee hero leads, in case the client ever sends a
  // malformed order — this persists to every storefront visit, so it's
  // worth being defensive here rather than trusting the form shape blindly.
  const cleanOrder = ["hero" as Section, ...order.filter((s, i) => s !== "hero" && order.indexOf(s) === i)];

  const currentOverrides = (access.store.sectionOverrides as Record<string, unknown> | null) ?? {};

  // Preserve the visual-builder payload when the legacy section controls save.
  // Both editors share this JSON field; replacing it wholesale here would
  // silently delete the published builder config.
  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      sectionOverrides: {
        ...currentOverrides,
        order: cleanOrder,
        hidden,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/store/${slug}/admin/builder`);
  revalidatePath(`/store/${slug}/admin/customize`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}
