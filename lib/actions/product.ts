"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import type { ActionResult } from "@/types/actions";

/**
 * Confirms the current user owns (or platform-manages) the store with this
 * slug, and returns its id. Every product mutation below calls this first —
 * never trust a storeId/slug passed from the client without this check.
 */
async function assertStoreAccess(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in." as const };

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { business: true },
  });
  if (!store) return { error: "Store not found." as const };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { error: "You don't have access to this store." as const };

  return { store };
}

export async function listProducts(slug: string) {
  const access = await assertStoreAccess(slug);
  if ("error" in access) return [];

  return prisma.product.findMany({
    where: { storeId: access.store.id },
    include: { category: true, inventory: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProduct(slug: string, productId: string) {
  const access = await assertStoreAccess(slug);
  if ("error" in access) return null;

  return prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
    include: { inventory: true },
  });
}

export async function createProduct(
  slug: string,
  input: ProductInput
): Promise<ActionResult<{ productId: string }>> {
  const access = await assertStoreAccess(slug);
  if ("error" in access) return { success: false, error: access.error };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const baseSlug = slugify(data.name, { lower: true, strict: true });
  let productSlug = baseSlug;
  let suffix = 1;
  while (
    await prisma.product.findUnique({
      where: { storeId_slug: { storeId: access.store.id, slug: productSlug } },
    })
  ) {
    suffix += 1;
    productSlug = `${baseSlug}-${suffix}`;
  }

  const product = await prisma.product.create({
    data: {
      storeId: access.store.id,
      categoryId: data.categoryId || null,
      type: data.type,
      name: data.name,
      slug: productSlug,
      description: data.description,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      currency: data.currency,
      images: data.images,
      isPublished: data.isPublished,
      digitalFileUrl: data.digitalFileUrl || null,
      rentalPeriodUnit: data.rentalPeriodUnit ?? null,
      inventory: {
        create: { quantity: data.quantity },
      },
    },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { productId: product.id } };
}

export async function updateProduct(
  slug: string,
  productId: string,
  input: ProductInput
): Promise<ActionResult<{ productId: string }>> {
  const access = await assertStoreAccess(slug);
  if ("error" in access) return { success: false, error: access.error };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
  });
  if (!existing) return { success: false, error: "Product not found." };

  await prisma.product.update({
    where: { id: productId },
    data: {
      categoryId: data.categoryId || null,
      type: data.type,
      name: data.name,
      description: data.description,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      currency: data.currency,
      images: data.images,
      isPublished: data.isPublished,
      digitalFileUrl: data.digitalFileUrl || null,
      rentalPeriodUnit: data.rentalPeriodUnit ?? null,
      inventory: {
        upsert: {
          create: { quantity: data.quantity, storeId: access.store.id },
          update: { quantity: data.quantity },
        },
      },
    },
  });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: { productId } };
}

export async function deleteProduct(slug: string, productId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if ("error" in access) return { success: false, error: access.error };

  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId: access.store.id },
  });
  if (!existing) return { success: false, error: "Product not found." };

  await prisma.product.delete({ where: { id: productId } });

  revalidatePath(`/store/${slug}/admin/products`);
  return { success: true, data: undefined };
}
