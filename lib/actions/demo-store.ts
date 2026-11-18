"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformStaff } from "@/lib/admin-guard";
import { OFFICIAL_SLUG } from "@/lib/browse";
import { ALL_BUSINESS_TYPE_NAMES, getStoreConfiguration } from "@/lib/capabilities";
import { getBusinessExperience } from "@/lib/business-experience";
import { getSampleListingsForBusinessType } from "@/lib/sample-listings";
import { fetchDemoPhotos } from "@/lib/demo-images";
import { pickUniqueSlug, slugifyCategory } from "@/lib/category-slug";
import { ensureOfficialAccount } from "@/lib/actions/official";
import { DEMO_DEFAULT_NICHE, DEMO_STORE_EMAIL, DEMO_PASSWORD_MIN } from "@/lib/demo-store";
import type { ActionResult } from "@/types/actions";

/**
 * The BizNest demo store.
 *
 * It is the existing official BizNest account (slug biznest-official, the one SupaAdmin manages for Browse)
 * given a real storefront and a normal dashboard login, so demos run on the main BizNest, not in SupaAdmin.
 * Nothing here applies to any other store: every action refuses unless the slug is the official one.
 */

const NOT_ALLOWED = "Admin PIN session expired or invalid. Please sign in again.";
const FAR_FUTURE = new Date("2099-12-31T00:00:00.000Z");

/**
 * Replaces the store's categories and sample listings with the ones for one niche, and points the store's
 * business type, capabilities and homepage at that niche. Used by set-up and by the Settings switcher.
 */
async function applyNiche(storeId: string, businessId: string, niche: string): Promise<void> {
  const sellsProductsGuess = getStoreConfiguration(niche).capabilities.includes("products");
  const offersServicesGuess = getStoreConfiguration(niche).capabilities.includes("services");
  const model = { sellsProducts: sellsProductsGuess, offersServices: offersServicesGuess };
  const config = getStoreConfiguration(niche, model);
  const experience = getBusinessExperience(niche, model, null);
  const samples = getSampleListingsForBusinessType(niche);
  // Photos are fetched before the transaction opens: never hold a DB transaction across HTTP calls.
  const photos = await fetchDemoPhotos(samples.map((s) => s.name));

  await prisma.$transaction(async (tx) => {
    // Clear the previous niche. Children first, because categories can point at a parent.
    await tx.product.deleteMany({ where: { storeId } });
    await tx.service.deleteMany({ where: { storeId } });
    await tx.category.deleteMany({ where: { storeId, parentId: { not: null } } });
    await tx.category.deleteMany({ where: { storeId } });

    await tx.business.update({
      where: { id: businessId },
      data: { category: niche, businessSubcategory: null, sellsProducts: model.sellsProducts, offersServices: model.offersServices },
    });
    await tx.store.update({
      where: { id: storeId },
      data: {
        businessType: niche,
        enabledModules: { capabilities: config.capabilities },
        storefrontConfig: { mode: experience.mode, navigation: experience.navigation, homepageSections: experience.preferredSections },
      },
    });

    const used = new Set<string>();
    const nextSlug = (name: string) => { const v = pickUniqueSlug(slugifyCategory(name), used); used.add(v); return v; };
    for (const [i, category] of config.defaultCategories.entries()) {
      const parent = await tx.category.create({ data: { storeId, slug: nextSlug(category.name), name: category.name, type: category.type, sortOrder: i } });
      for (const [j, sub] of (category.subcategories ?? []).entries()) {
        await tx.category.create({ data: { storeId, slug: nextSlug(sub), name: sub, type: category.type, parentId: parent.id, sortOrder: j } });
      }
    }

    for (const [i, sample] of samples.entries()) {
      const slug = slugify(sample.name, { lower: true, strict: true });
      const images = photos[i] ? [photos[i] as string] : [];
      if (sample.kind === "product") {
        await tx.product.create({
          data: {
            storeId, name: sample.name, slug, description: sample.description, price: sample.price, images,
            attributes: (sample.attributes as unknown as Prisma.InputJsonValue | undefined) ?? undefined,
            isPublished: true,
          },
        });
      } else {
        await tx.service.create({
          data: {
            storeId, name: sample.name, slug, description: sample.description, price: sample.price, images,
            isBookable: sample.isBookable ?? false, durationMins: sample.durationMins, isPublished: true,
          },
        });
      }
    }
  }, { timeout: 30_000 });
}

function revalidateDemo() {
  revalidatePath(`/store/${OFFICIAL_SLUG}`, "layout");
  revalidatePath(`/${OFFICIAL_SLUG}`);
  revalidatePath("/supaadmin/demo-store");
}

/**
 * Turns the official BizNest account into a working demo store with its own login (email + this password).
 * Safe to run again: it keeps the store and just resets the password.
 */
export async function setUpDemoStore(password: string): Promise<ActionResult<{ email: string; slug: string }>> {
  if (!(await isPlatformStaff())) return { success: false, error: NOT_ALLOWED };
  const pw = String(password ?? "");
  if (pw.length < DEMO_PASSWORD_MIN) return { success: false, error: `Use a password of at least ${DEMO_PASSWORD_MIN} characters.` };

  const base = await ensureOfficialAccount();
  if (!base.success) return { success: false, error: base.error };

  const store = await prisma.store.findUnique({ where: { slug: OFFICIAL_SLUG }, include: { business: true } });
  if (!store) return { success: false, error: "The official account could not be found." };

  const plan = await prisma.subscription.findFirst({ where: { name: "Business Mogul", isMarketingPlan: false }, select: { id: true } })
    ?? await prisma.subscription.findFirst({ where: { isActive: true, isMarketingPlan: false }, orderBy: { price: "desc" }, select: { id: true } });
  if (!plan) return { success: false, error: "No subscription plan exists to attach to the demo store." };

  const template = store.templateId
    ? null
    : await prisma.storeTemplate.findFirst({ where: { tierRank: { lte: 1 } }, orderBy: { createdAt: "asc" }, select: { id: true } });

  const passwordHash = await bcrypt.hash(pw, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: store.business.userId }, data: { passwordHash, email: DEMO_STORE_EMAIL, emailVerified: new Date(), role: "STORE_OWNER" } }),
    prisma.business.update({ where: { id: store.businessId }, data: { fraudPolicyAcceptedAt: store.business.fraudPolicyAcceptedAt ?? new Date(), searchVisible: false, email: DEMO_STORE_EMAIL } }),
    prisma.store.update({
      where: { id: store.id },
      data: {
        marketingOnly: false,
        // A demo is for showing, not for Google or the marketplace.
        seoNoIndex: true,
        subscriptionId: plan.id,
        subscriptionRenewsAt: FAR_FUTURE,
        trialEndsAt: null,
        ...(template ? { templateId: template.id } : {}),
      },
    }),
  ]);

  // First set-up gets the default niche; running it again keeps whatever niche is already chosen.
  const currentlyPlatform = store.businessType === "Platform" || !ALL_BUSINESS_TYPE_NAMES.includes(store.businessType);
  if (currentlyPlatform) await applyNiche(store.id, store.businessId, DEMO_DEFAULT_NICHE);

  await prisma.auditLog.create({ data: { action: "DEMO_STORE_SET_UP", entity: "Store", entityId: store.id } }).catch(() => undefined);
  revalidateDemo();
  return { success: true, data: { email: DEMO_STORE_EMAIL, slug: OFFICIAL_SLUG } };
}

/** Switches the demo store to another business niche from its Settings page. Owner (the demo login) or SupaAdmin staff only. */
export async function switchDemoNiche(slug: string, niche: string): Promise<ActionResult<{ niche: string }>> {
  if (slug !== OFFICIAL_SLUG) return { success: false, error: "Niche switching is only available on the BizNest demo store." };
  if (!ALL_BUSINESS_TYPE_NAMES.includes(niche)) return { success: false, error: "Choose a niche from the list." };

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, businessId: true, marketingOnly: true, business: { select: { userId: true } } } });
  if (!store) return { success: false, error: "Demo store not found." };
  if (store.marketingOnly) return { success: false, error: "Set up the demo store in SupaAdmin first." };

  const session = await auth();
  const isOwner = Boolean(session?.user?.id) && session!.user!.id === store.business.userId;
  if (!isOwner && !(await isPlatformStaff())) return { success: false, error: "Only the demo store's owner can switch its niche." };

  try {
    await applyNiche(store.id, store.businessId, niche);
  } catch {
    return { success: false, error: "Couldn't switch the niche. Try again in a moment." };
  }
  revalidateDemo();
  revalidatePath(`/store/${slug}/admin`, "layout");
  return { success: true, data: { niche } };
}
