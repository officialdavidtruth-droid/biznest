"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Section } from "@/lib/template-themes";
import type { ActionResult } from "@/types/actions";

const ALL_SECTIONS: Section[] = ["hero", "catalog", "about", "testimonials", "contact"];

async function assertStoreAccess(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false as const, error: "You don't have access to this store." };

  return { success: true as const, store };
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

  await prisma.store.update({
    where: { id: access.store.id },
    data: { sectionOverrides: { order: cleanOrder, hidden } },
  });

  revalidatePath(`/store/${slug}/admin/builder`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}
