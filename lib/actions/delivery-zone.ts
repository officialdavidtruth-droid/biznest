"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

export async function createDeliveryZone(slug: string, formData: FormData) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return;

  const name = String(formData.get("name") ?? "").trim();
  const fee = Number(formData.get("fee") ?? 0);
  const estimatedMinutes = formData.get("estimatedMinutes") ? Number(formData.get("estimatedMinutes")) : null;

  if (!name || !(fee >= 0)) return;

  await prisma.deliveryZone.create({
    data: { storeId: access.store.id, name, fee, estimatedMinutes },
  });

  revalidatePath(`/store/${slug}/admin/delivery`);
}

export async function toggleDeliveryZone(slug: string, zoneId: string, isActive: boolean) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return;

  await prisma.deliveryZone.updateMany({
    where: { id: zoneId, storeId: access.store.id },
    data: { isActive },
  });

  revalidatePath(`/store/${slug}/admin/delivery`);
}

/** Public — used by the storefront checkout to show available zones. No auth needed. */
export async function listActiveDeliveryZones(storeSlug: string) {
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) return [];

  return prisma.deliveryZone.findMany({
    where: { storeId: store.id, isActive: true },
    orderBy: { fee: "asc" },
  });
}
