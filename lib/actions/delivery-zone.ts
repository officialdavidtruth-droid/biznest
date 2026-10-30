"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { parseDeliveryZoneForm } from "@/lib/validations/delivery-zone";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logActivity } from "@/lib/activity-log";

// Delivery zones live under the store's Settings area in the nav (see
// dashboard-nav.ts), so a MANAGER/STAFF granted "settings" should be able
// to actually manage them here too — not just view the page.
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "settings");
}

/**
 * Reuses the store's existing spelling of a city ("Abuja" beats "abuja") and
 * rejects a zone whose city + name already exist (case-insensitive).
 */
async function resolveCityAndCheckDuplicate(
  storeId: string,
  city: string | null,
  name: string,
  excludeId?: string
): Promise<{ city: string | null; error?: string }> {
  let resolvedCity = city;
  if (city) {
    const existing = await prisma.deliveryZone.findFirst({
      where: { storeId, city: { equals: city, mode: "insensitive" } },
      select: { city: true },
    });
    if (existing?.city) resolvedCity = existing.city;
  }

  const duplicate = await prisma.deliveryZone.findFirst({
    where: {
      storeId,
      name: { equals: name, mode: "insensitive" },
      city: resolvedCity ? { equals: resolvedCity, mode: "insensitive" } : null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return { city: resolvedCity, error: "A zone with that name already exists for this city." };
  return { city: resolvedCity };
}

export async function createDeliveryZone(slug: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const parsed = parseDeliveryZoneForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error };
  const { name, fee, estimatedMinutes } = parsed.data;
  const resolved = await resolveCityAndCheckDuplicate(access.store.id, parsed.data.city, name);
  if (resolved.error) return { success: false, error: resolved.error };
  const city = resolved.city;

  const created = await prisma.deliveryZone.create({
    data: { storeId: access.store.id, city, name, fee, estimatedMinutes },
  });
  await logActivity({
    storeId: access.store.id,
    role: access.role,
    action: "delivery_zone.created",
    target: name,
    metadata: { zoneId: created.id, city, fee, estimatedMinutes },
  });

  revalidatePath(`/store/${slug}/admin/delivery`);
  return { success: true, data: undefined };
}

export async function updateDeliveryZone(slug: string, zoneId: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const parsed = parseDeliveryZoneForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error };
  const { name, fee, estimatedMinutes } = parsed.data;
  const resolved = await resolveCityAndCheckDuplicate(access.store.id, parsed.data.city, name, zoneId);
  if (resolved.error) return { success: false, error: resolved.error };
  const city = resolved.city;

  const before = await prisma.deliveryZone.findFirst({
    where: { id: zoneId, storeId: access.store.id },
    select: { fee: true, name: true },
  });
  const result = await prisma.deliveryZone.updateMany({
    where: { id: zoneId, storeId: access.store.id },
    data: { city, name, fee, estimatedMinutes },
  });
  if (result.count === 0) return { success: false, error: "Zone not found." };
  await logActivity({
    storeId: access.store.id,
    role: access.role,
    action: "delivery_zone.updated",
    target: name,
    metadata: { zoneId, city, previousFee: before ? Number(before.fee) : undefined, fee, estimatedMinutes },
  });

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
  const zone = await prisma.deliveryZone.findFirst({
    where: { id: zoneId, storeId: access.store.id },
    select: { name: true },
  });
  const inUse = await prisma.order.findFirst({ where: { deliveryZoneId: zoneId, storeId: access.store.id } });
  if (inUse) {
    await prisma.deliveryZone.updateMany({
      where: { id: zoneId, storeId: access.store.id },
      data: { isActive: false },
    });
    await logActivity({
      storeId: access.store.id,
      role: access.role,
      action: "delivery_zone.toggled",
      target: zone?.name,
      metadata: { zoneId, isActive: false, reason: "delete requested, zone has past orders" },
    });
    revalidatePath(`/store/${slug}/admin/delivery`);
    return { success: false, error: "This zone has past orders, so it was deactivated instead of deleted." };
  }

  await prisma.deliveryZone.deleteMany({ where: { id: zoneId, storeId: access.store.id } });
  await logActivity({
    storeId: access.store.id,
    role: access.role,
    action: "delivery_zone.deleted",
    target: zone?.name,
    metadata: { zoneId },
  });

  revalidatePath(`/store/${slug}/admin/delivery`);
  return { success: true, data: undefined };
}

export async function toggleDeliveryZone(slug: string, zoneId: string, isActive: boolean): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const result = await prisma.deliveryZone.updateMany({
    where: { id: zoneId, storeId: access.store.id },
    data: { isActive },
  });
  if (result.count === 0) return { success: false, error: "Zone not found." };
  const zone = await prisma.deliveryZone.findFirst({
    where: { id: zoneId, storeId: access.store.id },
    select: { name: true },
  });
  await logActivity({
    storeId: access.store.id,
    role: access.role,
    action: "delivery_zone.toggled",
    target: zone?.name,
    metadata: { zoneId, isActive },
  });

  revalidatePath(`/store/${slug}/admin/delivery`);
  return { success: true, data: undefined };
}

/** Public — used by the storefront checkout to show available zones. No auth needed. */
export async function listActiveDeliveryZones(storeSlug: string) {
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, status: true },
  });
  if (!store || store.status !== "ACTIVE") return [];

  const zones = await prisma.deliveryZone.findMany({
    where: { storeId: store.id, isActive: true },
    orderBy: [{ city: "asc" }, { fee: "asc" }],
    select: { id: true, city: true, name: true, fee: true, estimatedMinutes: true },
  });

  // Only what checkout needs, with the Decimal fee as a plain number so it
  // serializes cleanly to the client.
  return zones.map((z) => ({
    id: z.id,
    city: z.city,
    name: z.name,
    fee: Number(z.fee),
    estimatedMinutes: z.estimatedMinutes,
  }));
}
