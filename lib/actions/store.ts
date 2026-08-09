"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createStoreSchema, type CreateStoreInput } from "@/lib/validations/business";
import { generateUniqueStoreSlug, storeAdminUrl, storePublicUrl } from "@/lib/utils/slug";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { SAMPLE_LISTINGS } from "@/lib/sample-listings";
import { fetchDemoPhoto, fetchDemoPhotos } from "@/lib/demo-images";
import type { ActionResult } from "@/types/actions";
import { resolvePaystackAccount, createPaystackSubaccount } from "@/lib/payments/paystack";
import { resolveFlutterwaveAccount, createFlutterwaveSubaccount } from "@/lib/payments/flutterwave";

const DEFAULT_PAGES: Array<{ slug: string; title: string }> = [
  { slug: "home", title: "Home" },
  { slug: "about", title: "About" },
  { slug: "products", title: "Products" },
  { slug: "services", title: "Services" },
  { slug: "gallery", title: "Gallery" },
  { slug: "testimonials", title: "Testimonials" },
  { slug: "faq", title: "FAQ" },
  { slug: "blog", title: "Blog" },
  { slug: "contact", title: "Contact" },
  { slug: "policies", title: "Policies" },
];

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
  const template = await prisma.storeTemplate.findUnique({ where: { id: parsed.data.templateId } });
  const samples = template ? SAMPLE_LISTINGS[template.category] ?? [] : [];
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
        bannerUrl: bannerPhoto ?? undefined,
      },
    });

    await tx.storePage.createMany({
      data: DEFAULT_PAGES.map((p) => ({
        storeId: created.id,
        slug: p.slug,
        title: p.title,
        content: { blocks: [] },
      })),
    });

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
    });
    if (!subaccount.status || !subaccount.data) {
      return { success: false, error: subaccount.message || "Couldn't connect this account to Paystack." };
    }

    await prisma.store.update({
      where: { id: store.id },
      data: {
        paystackSubaccountCode: subaccount.data.subaccount_code,
        payoutVerifiedAt: new Date(),
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
        payoutVerifiedAt: new Date(),
        payoutDetails: { provider: "FLUTTERWAVE", bankName: input.bankName, accountName: resolved.data.account_name, maskedAccountNumber: masked },
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId: access.store.business.userId, action: "PAYOUT_ACCOUNT_CONNECTED", entity: "Store", entityId: store.id, metadata: { provider: input.provider } },
  });

  revalidatePath(`/store/${slug}/admin/payouts`);
  return { success: true, data: undefined };
}

export async function disconnectPayoutAccount(slug: string, provider: "PAYSTACK" | "FLUTTERWAVE"): Promise<ActionResult> {
  const access = await assertStoreOwner(slug);
  if (!access.success) return { success: false, error: access.error };

  await prisma.store.update({
    where: { id: access.store.id },
    data:
      provider === "PAYSTACK"
        ? { paystackSubaccountCode: null }
        : { flutterwaveSubaccountId: null },
  });

  await prisma.auditLog.create({
    data: { userId: access.store.business.userId, action: "PAYOUT_ACCOUNT_DISCONNECTED", entity: "Store", entityId: access.store.id, metadata: { provider } },
  });

  revalidatePath(`/store/${slug}/admin/payouts`);
  return { success: true, data: undefined };
}
