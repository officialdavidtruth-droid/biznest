"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { sanitizePromoPopup, type PromoPopupConfig } from "@/lib/storefront/promo-popup";
import type { ActionResult } from "@/types/actions";

/**
 * Saves the storefront promo pop-up. Lives in Store.storefrontConfig.promoPopup
 * (JSON) so it needs no migration; every other key in storefrontConfig
 * (mode, navigation, unitBooking, ...) is preserved.
 */
export async function savePromoPopup(slug: string, input: unknown): Promise<ActionResult<PromoPopupConfig>> {
  const access = await assertStorePermission(slug, "marketing");
  if (!access.success) return { success: false, error: access.error };

  // Marketing is part of the CRM & Sales app: same install / plan check as the marketing page.
  const entitlement = await getPluginEntitlement(access.store.id, "crm");
  if (!entitlement.allowed || !entitlement.installed) return { success: false, error: "Install the CRM & Sales app to use the promo pop-up." };

  const clean = sanitizePromoPopup(input);
  if (clean.enabled && !clean.headline) return { success: false, error: "Add a headline before turning the pop-up on." };
  if (clean.ctaTarget && !clean.ctaLabel) return { success: false, error: "Add button text or clear the button link." };

  // Fresh read inside the write path so we never clobber concurrent edits to other keys.
  const current = await prisma.store.findUnique({ where: { id: access.store.id }, select: { storefrontConfig: true } });
  const base =
    current?.storefrontConfig && typeof current.storefrontConfig === "object" && !Array.isArray(current.storefrontConfig)
      ? (current.storefrontConfig as Record<string, unknown>)
      : {};
  const prev = sanitizePromoPopup(base.promoPopup);
  // Bump version only when visitor-facing content changed, so toggling or
  // tweaking timing doesn't re-show the card to people who already dismissed it.
  const contentChanged =
    prev.headline !== clean.headline || prev.body !== clean.body || prev.couponCode !== clean.couponCode ||
    prev.eyebrow !== clean.eyebrow || prev.imageUrl !== clean.imageUrl || prev.ctaTarget !== clean.ctaTarget;
  const saved: PromoPopupConfig = { ...clean, version: contentChanged ? prev.version + 1 : prev.version };

  await prisma.store.update({
    where: { id: access.store.id },
    data: { storefrontConfig: { ...base, promoPopup: saved } as object },
  });

  revalidatePath(`/store/${slug}`, "layout");
  revalidatePath(`/store/${slug}/admin/promo-popup`);
  return { success: true, data: saved };
}
