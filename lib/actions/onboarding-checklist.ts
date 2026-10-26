"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { createProduct } from "@/lib/actions/product";
import { createService } from "@/lib/actions/service";
import { getStarterIdeas, mergeChecklistMeta, readChecklistMeta } from "@/lib/onboarding-checklist";
import type { ActionResult } from "@/types/actions";

// The checklist is an owner-facing guide, so these actions are owner-only (platform
// support can act on a store's behalf, same as everywhere else).
async function assertOwner(slug: string) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  if (access.role !== "OWNER" && access.role !== "PLATFORM_STAFF") {
    return { success: false as const, error: "Only the store owner can do this." };
  }
  return access;
}

async function saveMeta(
  storeId: string,
  profile: unknown,
  patch: { linkSharedAt?: string; dismissedAt?: string }
) {
  await prisma.store.update({
    where: { id: storeId },
    data: { onboardingProfile: mergeChecklistMeta(profile, patch) as Prisma.InputJsonValue },
  });
}

/** Called when the owner copies or shares their store link. Idempotent. */
export async function markStoreLinkShared(slug: string): Promise<ActionResult> {
  const access = await assertOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  if (!readChecklistMeta(access.store.onboardingProfile).linkSharedAt) {
    await saveMeta(access.store.id, access.store.onboardingProfile, { linkSharedAt: new Date().toISOString() });
  }
  revalidatePath(`/store/${slug}/admin`);
  return { success: true, data: undefined };
}

/** Hides the checklist card for good. */
export async function dismissFirstSaleChecklist(slug: string): Promise<ActionResult> {
  const access = await assertOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  await saveMeta(access.store.id, access.store.onboardingProfile, { dismissedAt: new Date().toISOString() });
  revalidatePath(`/store/${slug}/admin`);
  return { success: true, data: undefined };
}

/**
 * Adds the chosen starter ideas as UNPUBLISHED drafts. The client only sends idea ids:
 * the content (name, description, price) is recomputed here from the store's business
 * type, so it can't be tampered with. Goes through createProduct / createService, so
 * permissions, plan limits and slug uniqueness all apply exactly as in the normal forms.
 */
export async function addStarterListings(slug: string, ideaIds: string[]): Promise<ActionResult<{ created: number }>> {
  const access = await assertOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  if (!Array.isArray(ideaIds) || ideaIds.length === 0) return { success: false, error: "Pick at least one idea." };

  const store = access.store;
  const category = getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType });
  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id }, select: { name: true }, take: 500 }),
    prisma.service.findMany({ where: { storeId: store.id }, select: { name: true }, take: 500 }),
  ]);
  const available = getStarterIdeas(
    category,
    { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices },
    [...products, ...services].map((l) => l.name),
    10
  );
  const chosen = available.filter((i) => ideaIds.includes(i.id)).slice(0, 4);
  if (chosen.length === 0) return { success: false, error: "Those ideas aren't available any more. Refresh the page." };

  let created = 0;
  let firstError: string | null = null;
  for (const idea of chosen) {
    const result =
      idea.kind === "product"
        ? await createProduct(slug, {
            name: idea.name,
            type: "PHYSICAL",
            description: idea.description,
            price: idea.price,
            currency: "NGN",
            images: [],
            // Drafts: the vendor must set a real price, photo and stock, then publish.
            isPublished: false,
            quantity: 0,
          })
        : await createService(slug, {
            name: idea.name,
            description: idea.description,
            price: idea.price,
            currency: "NGN",
            images: [],
            isPublished: false,
            bookingMode: idea.bookingMode ?? "none",
            durationMins: idea.durationMins,
          });
    if (result.success) {
      created += 1;
    } else {
      // Stop at the first failure (most often a plan limit) rather than hammering it.
      firstError = result.error;
      break;
    }
  }

  if (created === 0) return { success: false, error: firstError ?? "Couldn't add those ideas. Please try again." };
  revalidatePath(`/store/${slug}/admin`);
  return { success: true, data: { created } };
}
