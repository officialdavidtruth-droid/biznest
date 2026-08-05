"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createStoreSchema, type CreateStoreInput } from "@/lib/validations/business";
import { generateUniqueStoreSlug, storeAdminUrl, storePublicUrl } from "@/lib/utils/slug";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import { SAMPLE_LISTINGS } from "@/lib/sample-listings";
import type { ActionResult } from "@/types/actions";

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

  const store = await prisma.$transaction(async (tx) => {
    const created = await tx.store.create({
      data: {
        businessId: business.id,
        name: parsed.data.storeName,
        slug,
        templateId: parsed.data.templateId,
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
    const template = await tx.storeTemplate.findUnique({ where: { id: parsed.data.templateId } });
    const samples = template ? SAMPLE_LISTINGS[template.category] ?? [] : [];
    for (const sample of samples) {
      const listingSlug = slugify(sample.name, { lower: true, strict: true });
      if (sample.kind === "product") {
        await tx.product.create({
          data: {
            storeId: created.id,
            name: sample.name,
            slug: listingSlug,
            description: sample.description,
            price: sample.price,
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

  for (const sample of samples) {
    const listingSlug = slugify(sample.name, { lower: true, strict: true });
    if (sample.kind === "product") {
      await prisma.product.create({
        data: {
          storeId: access.store.id,
          name: sample.name,
          slug: listingSlug,
          description: sample.description,
          price: sample.price,
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
  const primary = String(formData.get("primary") ?? "").trim();
  const secondary = String(formData.get("secondary") ?? "").trim();
  const accent = String(formData.get("accent") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();

  if (!name) return;

  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      name,
      contactEmail,
      contactPhone,
      themeColors: { primary, secondary, accent },
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
