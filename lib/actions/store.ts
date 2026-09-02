"use server";

import { getStoreConfiguration } from "@/lib/capabilities";
import { getBusinessExperience } from "@/lib/business-experience";
import { getTemplateBusinessType, isTemplateCompatible } from "@/lib/template-compatibility";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { createStoreSchema, type CreateStoreInput } from "@/lib/validations/business";
import { generateUniqueStoreSlug, storeAdminUrl, storePublicUrl, SLUG_FORMAT_RE, SLUG_MIN_LENGTH, SLUG_MAX_LENGTH } from "@/lib/utils/slug";
import { RESERVED_SLUGS } from "@/lib/constants/reserved-slugs";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { SAMPLE_LISTINGS } from "@/lib/sample-listings";
import { fetchDemoPhoto, fetchDemoPhotos } from "@/lib/demo-images";
import type { ActionResult } from "@/types/actions";
import { resolvePaystackAccount, createPaystackSubaccount, checkPaystackSubaccountVerification } from "@/lib/payments/paystack";
import { resolveFlutterwaveAccount, createFlutterwaveSubaccount } from "@/lib/payments/flutterwave";

/**
 * Store creation is gated on two things, checked server-side (never trust
 * the client here — this is where the business's ability to transact on
 * the platform is granted):
 *   1. Business.verificationStatus === "APPROVED"
 *   2. Business.fraudPolicyAcceptedAt is set
 */
export async function createStore(
  input: CreateStoreInput
): Promise<ActionResult<{ slug: string; publicUrl: string; adminUrl: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "You must be signed in." };
  }

  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const business = await prisma.business.findUnique({
    where: { id: parsed.data.businessId },
    include: { store: true },
  });

  if (!business || business.userId !== session.user.id) {
    return { success: false, error: "Business not found." };
  }
  if (business.verificationStatus !== "APPROVED") {
    return { success: false, error: "Your business must be approved before you can create a store." };
  }
  if (!business.fraudPolicyAcceptedAt) {
    return { success: false, error: "You must accept the fraud policy before creating a store." };
  }
  if (business.store) {
    return { success: false, error: "This business already has a store." };
  }

  // A brand-new store has no subscription yet, so it starts at Free (rank
  // 1) — reject any template above that here, not just in the gallery UI.
  // Same gap this exact check closed in lib/actions/template.ts: a client-
  // side lock is a convenience, not enforcement.
  if (parsed.data.templateId) {
    const chosenTemplate = await prisma.storeTemplate.findUnique({ where: { id: parsed.data.templateId } });
    if (chosenTemplate && !isTemplateCompatible(chosenTemplate, business.category, { sellsProducts: business.sellsProducts, offersServices: business.offersServices })) {
      return { success: false, error: "That website design is not compatible with this business model. Choose a product, service, or hybrid design that matches what you selected during onboarding." };
    }
    if (chosenTemplate && chosenTemplate.tierRank > 1) {
      return { success: false, error: "That template requires a paid plan. Pick a Free template for now — you can upgrade and switch after your store is created." };
    }
  }

  const slug = await generateUniqueStoreSlug(parsed.data.storeName);

  // Fetched before the transaction, not inside it — holding a DB
  // transaction open across external HTTP calls risks connection timeouts.
  // Real stock photography (lib/demo-images.ts) — works with zero config
  // (LoremFlickr fallback), upgrades automatically to Unsplash if
  // UNSPLASH_ACCESS_KEY is set.
  const template = parsed.data.templateId
    ? await prisma.storeTemplate.findUnique({ where: { id: parsed.data.templateId } })
    : null;
  const templateBusinessType = template ? getTemplateBusinessType(template) : null;
  const samples = templateBusinessType ? SAMPLE_LISTINGS[templateBusinessType] ?? [] : [];
  const [samplePhotos, bannerPhoto] = await Promise.all([
    fetchDemoPhotos(samples.map((s) => s.name)),
    template ? fetchDemoPhoto(template.category) : Promise.resolve(null),
  ]);

  const store = await prisma.$transaction(async (tx) => {
    const created = await tx.store.create({
      data: {
        businessId: business.id,
        name: parsed.data.storeName,
        slug,
        templateId: parsed.data.templateId,
        businessType: business.category,
        enabledModules: { capabilities: getStoreConfiguration(business.category, { sellsProducts: business.sellsProducts, offersServices: business.offersServices }).capabilities },
        storefrontConfig: {
          mode: getBusinessExperience(business.category, { sellsProducts: business.sellsProducts, offersServices: business.offersServices }, business.businessSubcategory).mode,
          navigation: getBusinessExperience(business.category, { sellsProducts: business.sellsProducts, offersServices: business.offersServices }, business.businessSubcategory).navigation,
          homepageSections: getBusinessExperience(business.category, { sellsProducts: business.sellsProducts, offersServices: business.offersServices }, business.businessSubcategory).preferredSections,
        },
        // A logo/banner uploaded in the onboarding wizard's branding step
        // wins over the auto-fetched demo banner — that photo is only a
        // placeholder for stores that skipped branding.
        logoUrl: parsed.data.logoUrl || undefined,
        bannerUrl: parsed.data.bannerUrl || bannerPhoto || undefined,
        onboardingProfile: parsed.data.onboardingProfile ?? undefined,
      },
    });

    const websitePages = getBusinessExperience(business.category, { sellsProducts: business.sellsProducts, offersServices: business.offersServices }, business.businessSubcategory).pageSlugs;
    await tx.storePage.createMany({
      data: websitePages.map((p) => ({
        storeId: created.id,
        slug: p.slug,
        title: p.title,
        content: { blocks: [] },
      })),
    });

    // Create store-owned category trees from the selected business type.
    // These are real rows owned by this store, not shared platform categories.
    const businessConfig = getStoreConfiguration(business.category, { sellsProducts: business.sellsProducts, offersServices: business.offersServices });
    const categoryIds = new Map<string, string>();
    for (const [categoryIndex, category] of businessConfig.defaultCategories.entries()) {
      const parent = await tx.category.create({
        data: {
          storeId: created.id,
          name: category.name,
          type: category.type,
          sortOrder: categoryIndex,
        },
      });
      categoryIds.set(category.name, parent.id);
      for (const [subcategoryIndex, subcategory] of (category.subcategories ?? []).entries()) {
        await tx.category.create({
          data: {
            storeId: created.id,
            name: subcategory,
            type: category.type,
            parentId: parent.id,
            sortOrder: subcategoryIndex,
          },
        });
      }
    }

    // Seed 2 starter listings matching the chosen template's niche, so the
    // storefront looks like a real, designed template immediately instead
    // of an empty shell — the vendor edits or deletes these like any other
    // listing. Without this, every new store is genuinely blank until the
    // vendor manually adds something, which reads as "broken" even when
    // the template itself is rendering correctly (see round 5 discussion).
    // template/samples/samplePhotos were fetched before this transaction opened.
    for (const [i, sample] of samples.entries()) {
      const listingSlug = slugify(sample.name, { lower: true, strict: true });
      const images = samplePhotos[i] ? [samplePhotos[i] as string] : [];
      if (sample.kind === "product") {
        await tx.product.create({
          data: {
            storeId: created.id,
            name: sample.name,
            slug: listingSlug,
            description: sample.description,
            price: sample.price,
            images,
            attributes: (sample.attributes as unknown as Prisma.InputJsonValue | undefined) ?? undefined,
            isPublished: true,
          },
        });
      } else {
        await tx.service.create({
          data: {
            storeId: created.id,
            name: sample.name,
            slug: listingSlug,
            description: sample.description,
            price: sample.price,
            images,
            isBookable: sample.isBookable ?? false,
            durationMins: sample.durationMins,
            isPublished: true,
          },
        });
      }
    }

    // Promote the user so dashboard/role-gated routes recognize them.
    await tx.user.update({
      where: { id: session.user.id },
      data: { role: "STORE_OWNER" },
    });

    return created;
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "STORE_CREATED",
      entity: "Store",
      entityId: store.id,
    },
  });

  revalidatePath("/onboarding");
  return {
    success: true,
    data: {
      slug: store.slug,
      publicUrl: storePublicUrl(store.slug),
      adminUrl: storeAdminUrl(store.slug),
    },
  };
}

/**
 * For listings that already exist but have no photo — e.g. created before
 * demo photography existed, or added manually without an image. Only fills
 * in what's missing; never touches a listing that already has an image.
 */
export async function backfillListingImages(slug: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { storeId: access.store.id, images: { isEmpty: true } } }),
    prisma.service.findMany({ where: { storeId: access.store.id, images: { isEmpty: true } } }),
  ]);
  if (products.length === 0 && services.length === 0) {
    return { success: false, error: "Every listing already has a photo." };
  }

  const photos = await fetchDemoPhotos([...products.map((p) => p.name), ...services.map((s) => s.name)]);

  await Promise.all([
    ...products.map((p, i) =>
      photos[i]
        ? prisma.product.update({ where: { id: p.id }, data: { images: [photos[i] as string] } })
        : Promise.resolve()
    ),
    ...services.map((s, i) =>
      photos[products.length + i]
        ? prisma.service.update({ where: { id: s.id }, data: { images: [photos[products.length + i] as string] } })
        : Promise.resolve()
    ),
  ]);

  revalidatePath(`/store/${slug}/admin`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

export async function seedSampleListings(slug: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const [productCount, serviceCount] = await Promise.all([
    prisma.product.count({ where: { storeId: access.store.id } }),
    prisma.service.count({ where: { storeId: access.store.id } }),
  ]);
  if (productCount > 0 || serviceCount > 0) {
    return { success: false, error: "This store already has listings — starter samples are only for empty stores." };
  }

  const store = await prisma.store.findUnique({ where: { id: access.store.id }, include: { template: true } });
  const samples = store?.template ? SAMPLE_LISTINGS[store.template.category] ?? [] : [];
  if (samples.length === 0) {
    return { success: false, error: "No starter listings are defined for this store's template yet." };
  }

  // Real stock photography, not fabricated — see lib/demo-images.ts. Works
  // with zero config (LoremFlickr fallback); upgrades automatically to
  // Unsplash if UNSPLASH_ACCESS_KEY is set. Fetched once here and
  // persisted to the listing/store rows, never re-fetched on every page view.
  const photos = await fetchDemoPhotos(samples.map((s) => s.name));
  if (store && !store.bannerUrl && store.template) {
    const bannerPhoto = await fetchDemoPhoto(store.template.category);
    if (bannerPhoto) {
      await prisma.store.update({ where: { id: store.id }, data: { bannerUrl: bannerPhoto } });
    }
  }

  for (const [i, sample] of samples.entries()) {
    const listingSlug = slugify(sample.name, { lower: true, strict: true });
    const images = photos[i] ? [photos[i] as string] : [];
    if (sample.kind === "product") {
      await prisma.product.create({
        data: {
          storeId: access.store.id,
          name: sample.name,
          slug: listingSlug,
          description: sample.description,
          price: sample.price,
          images,
          attributes: (sample.attributes as unknown as Prisma.InputJsonValue | undefined) ?? undefined,
          isPublished: true,
        },
      });
    } else {
      await prisma.service.create({
        data: {
          storeId: access.store.id,
          name: sample.name,
          slug: listingSlug,
          description: sample.description,
          price: sample.price,
          images,
          isBookable: sample.isBookable ?? false,
          durationMins: sample.durationMins,
          isPublished: true,
        },
      });
    }
  }

  revalidatePath(`/store/${slug}/admin`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

// Storefront settings/branding/hero/story overrides live under "settings"
// in the nav (dashboard-nav.ts) — separate from assertStoreOwner below,
// which gates payouts/billing and stays owner-only.
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "settings");
}

/** Storefront settings: branding, theme colors, contact info, social links. */
export async function updateStoreSettings(slug: string, formData: FormData) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim() || null;
  const contactPhone = String(formData.get("contactPhone") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const bannerUrl = String(formData.get("bannerUrl") ?? "").trim() || null;
  const primary = String(formData.get("primary") ?? "").trim();
  const secondary = String(formData.get("secondary") ?? "").trim();
  const accent = String(formData.get("accent") ?? "").trim();
  const fontFamily = String(formData.get("fontFamily") ?? "").trim() || null;
  const instagram = String(formData.get("instagram") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();

  if (!name) return;

  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      name,
      contactEmail,
      contactPhone,
      logoUrl,
      bannerUrl,
      themeColors: { primary, secondary, accent },
      fontFamily,
      socialLinks: { instagram, whatsapp },
    },
  });

  // Business.description backs the storefront's About section — it was
  // only ever set once, during onboarding, with no way to edit it after.
  // That's how a vendor ends up permanently stuck with placeholder/test
  // text on their live storefront. Optional here on purpose: leave it
  // untouched if the field is submitted empty, rather than blanking real
  // content by accident.
  if (description) {
    await prisma.business.update({
      where: { id: access.store.business.id },
      data: { description },
    });
  }

  revalidatePath(`/store/${slug}/admin/settings`);
  revalidatePath(`/store/${slug}`);
}

/**
 * Validates a candidate slug against every rule that would cause
 * updateStoreSlug to reject it, without writing anything — used for the
 * live "already exists" feedback in the settings UI as the owner types.
 * Deliberately treats the store's own current slug as "available" so the
 * UI doesn't flag an unchanged value as taken.
 */
export async function checkSlugAvailability(
  currentSlug: string,
  candidate: string
): Promise<{ available: boolean; reason?: string }> {
  const raw = candidate.trim().toLowerCase();
  if (raw === currentSlug) return { available: true };
  if (!raw) return { available: false, reason: "Enter a URL." };
  if (raw.length < SLUG_MIN_LENGTH || raw.length > SLUG_MAX_LENGTH) {
    return { available: false, reason: `Must be ${SLUG_MIN_LENGTH}–${SLUG_MAX_LENGTH} characters.` };
  }
  if (!SLUG_FORMAT_RE.test(raw)) {
    return { available: false, reason: "Only lowercase letters, numbers, and hyphens." };
  }
  if (RESERVED_SLUGS.has(raw)) {
    return { available: false, reason: "That URL is reserved." };
  }

  const [slugTaken, historyTaken] = await Promise.all([
    prisma.store.findUnique({ where: { slug: raw }, select: { id: true } }),
    prisma.storeSlugHistory.findUnique({ where: { oldSlug: raw }, select: { id: true } }),
  ]);
  if (slugTaken || historyTaken) return { available: false, reason: "Already taken." };

  return { available: true };
}

/**
 * Lets an owner shorten/rename their store's URL (e.g. "truth-empire-
 * logistics" -> "tel"), any time, as long as the new slug is free.
 *
 * The old slug is never deleted — it's archived to StoreSlugHistory so
 * anyone who already bookmarked/shared biznest.space/<old-slug> lands on
 * the store's new URL instead of a dead link (see the redirect in
 * app/store/[slug]/layout.tsx). Staff whose login handle is
 * "<username>@<old-slug>" also keep working, via the same history lookup
 * in lib/auth.ts — but they should still be told about the new handle,
 * since biznest.space links they share elsewhere still show the old slug
 * until they update those links.
 */
export async function updateStoreSlug(
  currentSlug: string,
  formData: FormData
): Promise<ActionResult<{ slug: string; publicUrl: string }>> {
  const access = await assertStoreAccess(currentSlug);
  if (!access.success) return { success: false, error: access.error };

  const raw = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (raw === currentSlug) {
    return { success: true, data: { slug: currentSlug, publicUrl: storePublicUrl(currentSlug) } };
  }
  if (raw.length < SLUG_MIN_LENGTH || raw.length > SLUG_MAX_LENGTH) {
    return { success: false, error: `Your store URL must be ${SLUG_MIN_LENGTH}–${SLUG_MAX_LENGTH} characters.` };
  }
  if (!SLUG_FORMAT_RE.test(raw)) {
    return { success: false, error: "Use only lowercase letters, numbers, and hyphens — no spaces, symbols, or leading/trailing hyphens." };
  }
  if (RESERVED_SLUGS.has(raw)) {
    return { success: false, error: "That URL is reserved. Try something else." };
  }

  // Re-check right before writing (not just relying on the live UI check),
  // since another store could have claimed it in between.
  const [slugTaken, historyTaken] = await Promise.all([
    prisma.store.findUnique({ where: { slug: raw }, select: { id: true } }),
    prisma.storeSlugHistory.findUnique({ where: { oldSlug: raw }, select: { id: true } }),
  ]);
  if (slugTaken || historyTaken) {
    return { success: false, error: "That URL is already taken. Try another." };
  }

  await prisma.$transaction([
    prisma.storeSlugHistory.create({ data: { storeId: access.store.id, oldSlug: currentSlug } }),
    prisma.store.update({ where: { id: access.store.id }, data: { slug: raw } }),
  ]);

  await prisma.auditLog.create({
    data: { userId: access.store.business.userId, action: "STORE_SLUG_CHANGED", entity: "Store", entityId: access.store.id, metadata: { from: currentSlug, to: raw } },
  });

  revalidatePath(`/store/${currentSlug}/admin/settings`);
  revalidatePath(`/store/${raw}/admin/settings`);
  revalidatePath(`/${currentSlug}`);
  revalidatePath(`/${raw}`);

  return { success: true, data: { slug: raw, publicUrl: storePublicUrl(raw) } };
}

export type HeroOverrides = { headline?: string; subtitle?: string; ctaLabel?: string };

/**
 * Click-to-edit save for the hero background image. Separate from
 * updateStoreSettings (which also writes bannerUrl) because the hero editor
 * saves fields independently as the vendor clicks through blocks — reusing
 * the same underlying bannerUrl column that Settings already uses, so a
 * change here is reflected in Settings too, and vice versa.
 */
export async function updateHeroImage(slug: string, bannerUrl: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  await prisma.store.update({
    where: { id: access.store.id },
    data: { bannerUrl: bannerUrl.trim() || null },
  });

  revalidatePath(`/store/${slug}/admin/website-editor`);
  revalidatePath(`/store/${slug}/admin/settings`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

/**
 * Click-to-edit hero block save (see components/dashboard/hero-block-editor.tsx).
 * Distinct from updateStoreSettings on purpose: the hero editor saves one block
 * at a time as the vendor edits in place, so it shouldn't touch — or require
 * resubmitting — the rest of the settings form.
 */
export async function updateHeroOverrides(slug: string, overrides: HeroOverrides): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const clean: HeroOverrides = {};
  if (overrides.headline?.trim()) clean.headline = overrides.headline.trim();
  if (overrides.subtitle?.trim()) clean.subtitle = overrides.subtitle.trim();
  if (overrides.ctaLabel?.trim()) clean.ctaLabel = overrides.ctaLabel.trim();

  const existing = (access.store.heroOverrides as HeroOverrides | null) ?? {};
  await prisma.store.update({
    where: { id: access.store.id },
    data: { heroOverrides: { ...existing, ...clean } },
  });

  revalidatePath(`/store/${slug}/admin/website-editor`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

/**
 * Click-to-edit save for the Story/About block's own image. Separate column
 * (storyImage) from bannerUrl -- previously the About section just displayed
 * bannerUrl with no click handler at all, which is why it looked
 * uneditable. Falls back to bannerUrl/template preview when unset, same
 * fallback chain as before, but a vendor can now override it independently.
 */
export async function updateStoryImage(slug: string, imageUrl: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  await prisma.store.update({
    where: { id: access.store.id },
    data: { storyImage: imageUrl.trim() || null },
  });

  revalidatePath(`/store/${slug}/admin/website-editor`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

export type StoryOverrides = { eyebrow?: string; heading?: string; body?: string };

/**
 * Click-to-edit save for the "story" (About) block — same one-block-at-a-time
 * pattern as updateHeroOverrides above.
 */
export async function updateStoryOverrides(slug: string, overrides: StoryOverrides): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const clean: StoryOverrides = {};
  if (overrides.eyebrow?.trim()) clean.eyebrow = overrides.eyebrow.trim();
  if (overrides.heading?.trim()) clean.heading = overrides.heading.trim();
  if (overrides.body?.trim()) clean.body = overrides.body.trim();

  const existing = (access.store.storyOverrides as StoryOverrides | null) ?? {};
  await prisma.store.update({
    where: { id: access.store.id },
    data: { storyOverrides: { ...existing, ...clean } },
  });

  revalidatePath(`/store/${slug}/admin/website-editor`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}

// --- Payout account (seller connects Paystack or Flutterwave to get paid) --

async function assertStoreOwner(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true, subscription: true } });
  if (!store) return { success: false as const, error: "Store not found." };
  if (store.business.userId !== session.user.id) {
    return { success: false as const, error: "You don't have access to this store." };
  }
  return { success: true as const, store };
}

export async function getPayoutStatus(slug: string) {
  const access = await assertStoreOwner(slug);
  if (!access.success) return null;
  const { store } = access;
  return {
    paystackConnected: Boolean(store.paystackSubaccountCode),
    flutterwaveConnected: Boolean(store.flutterwaveSubaccountId),
    payoutDetails: store.payoutDetails as { bankName?: string; accountName?: string; maskedAccountNumber?: string; provider?: "PAYSTACK" | "FLUTTERWAVE" } | null,
    connectedAt: store.payoutConnectedAt,
    // Whether the gateway has actually confirmed KYC, not just that an
    // account is linked -- see checkPaystackSubaccountVerification. Until
    // this is set, warn the owner their first payout will be held.
    verifiedAt: store.payoutVerifiedAt,
    commissionRate: Number(store.subscription?.commissionRate ?? 8),
  };
}

/**
 * Resolves the account name first (so a mistyped account number is caught
 * before we save anything), then creates a real subaccount with the
 * relevant gateway so future order payments split automatically — the
 * store's cut lands directly in their bank account, ours in the platform's.
 */
export async function connectPayoutAccount(
  slug: string,
  input: { provider: "PAYSTACK" | "FLUTTERWAVE"; bankCode: string; bankName: string; accountNumber: string }
): Promise<ActionResult> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  const { store } = access;

  if (!/^\d{10}$/.test(input.accountNumber)) {
    return { success: false, error: "Enter a valid 10-digit account number." };
  }

  const commissionRate = Number(store.subscription?.commissionRate ?? 8);
  const masked = `••••••${input.accountNumber.slice(-4)}`;

  if (input.provider === "PAYSTACK") {
    const resolved = await resolvePaystackAccount(input.accountNumber, input.bankCode);
    if (!resolved.status || !resolved.data) {
      return { success: false, error: resolved.message || "Couldn't verify that account number." };
    }

    const subaccount = await createPaystackSubaccount({
      businessName: store.name,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      commissionPercentage: commissionRate,
      primaryContactName: store.business.businessName,
      primaryContactEmail: store.business.email,
      primaryContactPhone: store.business.phone,
      description: `BizNest merchant payout account for ${store.name}`,
    });
    if (!subaccount.status || !subaccount.data) {
      return { success: false, error: subaccount.message || "Couldn't connect this account to Paystack." };
    }

    await prisma.store.update({
      where: { id: store.id },
      data: {
        paystackSubaccountCode: subaccount.data.subaccount_code,
        // Verification belongs to this exact provider account. Never inherit
        // an older verification timestamp when a new subaccount is created.
        payoutVerifiedAt: subaccount.data.is_verified ? new Date() : null,
        // Connected, not verified -- Paystack still has to manually
        // review KYC before this subaccount's first payout releases.
        // payoutVerifiedAt stays null until refreshPayoutVerification
        // confirms is_verified against the real API.
        payoutConnectedAt: new Date(),
        payoutDetails: { provider: "PAYSTACK", bankName: input.bankName, accountName: resolved.data.account_name, maskedAccountNumber: masked },
      },
    });
  } else {
    const resolved = await resolveFlutterwaveAccount(input.accountNumber, input.bankCode);
    if (resolved.status !== "success" || !resolved.data) {
      return { success: false, error: resolved.message || "Couldn't verify that account number." };
    }

    const subaccount = await createFlutterwaveSubaccount({
      businessName: store.name,
      businessEmail: store.business.email,
      businessPhone: store.business.phone,
      businessContact: store.business.businessName,
      businessContactPhone: store.business.phone,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      splitPercentage: commissionRate,
    });
    if (subaccount.status !== "success" || !subaccount.data) {
      return { success: false, error: subaccount.message || "Couldn't connect this account to Flutterwave." };
    }

    await prisma.store.update({
      where: { id: store.id },
      data: {
        flutterwaveSubaccountId: subaccount.data.subaccount_id ?? String(subaccount.data.id),
        // Same connected-vs-verified split as the Paystack branch above,
        // for consistency in the shared Store fields. Flutterwave's own
        // verification model isn't confirmed yet -- treat as connected
        // only until that's checked the same way.
        payoutConnectedAt: new Date(),
        payoutDetails: { provider: "FLUTTERWAVE", bankName: input.bankName, accountName: resolved.data.account_name, maskedAccountNumber: masked },
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId: access.store.business.userId, action: "PAYOUT_ACCOUNT_CONNECTED", entity: "Store", entityId: store.id, metadata: { provider: input.provider } },
  });

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: undefined };
}

/**
 * Re-checks Paystack's actual verification status for this store's
 * subaccount and stamps payoutVerifiedAt the first time it comes back
 * true. Paystack has no webhook for this (confirmed via support, Aug
 * 2026 -- verification is a manual dashboard review), so this only
 * updates on demand: call it from a "Refresh status" button on the
 * payouts page, or wire it into a periodic job later if polling on a
 * schedule turns out to matter more than on-demand checks.
 */
export async function refreshPayoutVerification(slug: string): Promise<ActionResult<{ verified: boolean }>> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return { success: false, error: access.error };
  const { store } = access;

  if (!store.paystackSubaccountCode) {
    return { success: false, error: "No Paystack payout account connected yet." };
  }
  if (store.payoutVerifiedAt) {
    return { success: true, data: { verified: true } };
  }

  const result = await syncPaystackPayoutVerification(store.id, store.paystackSubaccountCode);
  if (!result.status) {
    return { success: false, error: result.message || "Couldn't reach Paystack to check verification status." };
  }

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: { verified: result.isVerified } };
}

/**
 * Shared core of the verification check, used both by the owner-facing
 * "Refresh status" button above and by the periodic sweep in
 * app/api/cron/payout-verification -- kept in one place so the two
 * callers can't drift on what "verified" means or how it's stamped.
 * Callers are responsible for skipping stores that already have
 * payoutVerifiedAt set (cheap short-circuit, avoids a wasted API call).
 */
export async function syncPaystackPayoutVerification(
  storeId: string,
  subaccountCode: string
): Promise<{ status: boolean; message?: string; isVerified: boolean }> {
  const result = await checkPaystackSubaccountVerification(subaccountCode);
  if (!result.status) {
    return { status: false, message: result.message, isVerified: false };
  }
  if (result.isVerified) {
    await prisma.store.update({ where: { id: storeId }, data: { payoutVerifiedAt: new Date() } });
  }
  return { status: true, isVerified: Boolean(result.isVerified) };
}

export async function disconnectPayoutAccount(slug: string, provider: "PAYSTACK" | "FLUTTERWAVE"): Promise<ActionResult> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return { success: false, error: access.error };

  await prisma.store.update({
    where: { id: access.store.id },
    data:
      provider === "PAYSTACK"
        ? { paystackSubaccountCode: null, payoutVerifiedAt: null, payoutConnectedAt: null }
        : { flutterwaveSubaccountId: null, payoutVerifiedAt: null, payoutConnectedAt: null },
  });

  await prisma.auditLog.create({
    data: { userId: access.store.business.userId, action: "PAYOUT_ACCOUNT_DISCONNECTED", entity: "Store", entityId: access.store.id, metadata: { provider } },
  });

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: undefined };
}
