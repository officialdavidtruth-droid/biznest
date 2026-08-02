"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStoreSchema, type CreateStoreInput } from "@/lib/validations/business";
import { generateUniqueStoreSlug, storeAdminUrl, storePublicUrl } from "@/lib/utils/slug";
import { revalidatePath } from "next/cache";
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
