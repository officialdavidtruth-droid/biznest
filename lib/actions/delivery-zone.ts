"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

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

export async function createDeliveryZone(slug: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const city = String(formData.get("city") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const fee = Number(formData.get("fee") ?? 0);
  const estimatedMinutes = formData.get("estimatedMinutes") ? Number(formData.get("estimatedMinutes")) : null;

  if (!name) return { success: false, error: "Zone name is required." };
  if (!(fee >= 0)) return { success: false, error: "Fee must be zero or more." };

  await prisma.deliveryZone.create({
    data: { storeId: access.store.id, city, name, fee, estimatedMinutes },
  });

  revalidatePath(`/store/${slug}/admin/delivery`);
  return { success: true, data: undefined };
}

export async function updateDeliveryZone(slug: string, zoneId: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const city = String(formData.get("city") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const fee = Number(formData.get("fee") ?? 0);
  const estimatedMinutes = formData.get("estimatedMinutes") ? Number(formData.get("estimatedMinutes")) : null;

  if (!name) return { success: false, error: "Zone name is required." };
  if (!(fee >= 0)) return { success: false, error: "Fee must be zero or more." };

  const result = await prisma.deliveryZone.updateMany({
    where: { id: zoneId, storeId: access.store.id },
    data: { city, name, fee, estimatedMinutes },
  });
  if (result.count === 0) return { success: false, error: "Zone not found." };

  revalidatePath(`/store/${slug}/admin/delivery`);
  return { success: true, data: undefined };
}

export async function deleteDeliveryZone(slug: string, zoneId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  // Zones referenced by past orders (Order.deliveryZoneId) are kept for
  // history — deactivate instead of hard-deleting so old orders don't lose
  // their delivery-area reference. Only zones with no orders can actually
  // be removed.
  const inUse = await prisma.order.findFirst({ where: { deliveryZoneId: zoneId, storeId: access.store.id } });
  if (inUse) {
    await prisma.deliveryZone.updateMany({
      where: { id: zoneId, storeId: access.store.id },
      data: { isActive: false },
    });
    revalidatePath(`/store/${slug}/admin/delivery`);
    return { success: false, error: "This zone has past orders, so it was deactivated instead of deleted." };
  }

  await prisma.deliveryZone.deleteMany({ where: { id: zoneId, storeId: access.store.id } });

  revalidatePath(`/store/${slug}/admin/delivery`);
  return { success: true, data: undefined };
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
    orderBy: [{ city: "asc" }, { fee: "asc" }],
  });
}
