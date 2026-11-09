"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStoreOwnerAccess } from "@/lib/access/assert-store-access";
import { CANONICAL_BUSINESS_TYPES } from "@/lib/business-identity";
import { isNicheTestStore } from "@/lib/niche-test";
import type { ActionResult } from "@/types/actions";

/** Testing aid: changes the store's business type (Business.category and the legacy Store.businessType mirror). */
export async function switchBusinessTypeForTesting(slug: string, type: string): Promise<ActionResult<{ from: string; to: string }>> {
  if (!isNicheTestStore(slug)) return { success: false, error: "This store isn't set up for niche testing." };
  const access = await assertStoreOwnerAccess(slug);
  if (!access.success) return access;
  if (!(CANONICAL_BUSINESS_TYPES as readonly string[]).includes(type)) return { success: false, error: "Unknown business type." };

  const store = await prisma.store.findUnique({ where: { id: access.store.id }, select: { id: true, businessId: true, businessType: true, business: { select: { category: true } } } });
  if (!store) return { success: false, error: "Store not found." };
  const from = store.business.category || store.businessType;
  await prisma.$transaction([
    prisma.business.update({ where: { id: store.businessId }, data: { category: type } }),
    prisma.store.update({ where: { id: store.id }, data: { businessType: type } }),
  ]);
  revalidatePath(`/store/${slug}`, "layout");
  return { success: true, data: { from, to: type } };
}
