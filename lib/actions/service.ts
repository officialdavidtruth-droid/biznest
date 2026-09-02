"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
import type { ActionResult } from "@/types/actions";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { assertUnderPlanLimit } from "@/lib/entitlements";
import { serviceSchema, type ServiceInput } from "@/lib/validations/service";

// "products" permission — services live under the same "Products &
// inventory" checkbox as products. See product.ts's assertStoreAccess for
// why this delegates to assertStorePermission instead of the old
// owner-only check.
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "products");
}

async function uniqueServiceSlug(storeId: string, base: string): Promise<string> {
  const root = slugify(base, { lower: true, strict: true }) || "service";
  let candidate = root;
  let n = 1;
  while (await prisma.service.findFirst({ where: { storeId, slug: candidate } })) {
    candidate = `${root}-${++n}`;
  }
  return candidate;
}

export async function getService(slug: string, serviceId: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return null;

  return prisma.service.findFirst({
    where: { id: serviceId, storeId: access.store.id },
  });
}

export async function createService(slug: string, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const entitlement = await assertUnderPlanLimit(access.store.id, "services");
  if (!entitlement.allowed) return { success: false, error: entitlement.error };

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, storeId: access.store.id }, select: { id: true } });
    if (!category) return { success: false, error: "Category does not belong to this store." };
  }

  if (data.bookingMode === "appointment" && !data.durationMins) {
    return { success: false, error: "Bookable services need a duration." };
  }
  if (data.bookingMode === "units" && !data.totalUnits) {
    return { success: false, error: "Set the number of units for this service." };
  }

  const totalUnits = data.bookingMode === "units" ? data.totalUnits! : null;
  const isBookable = data.bookingMode !== "none";
  const durationMins = data.bookingMode === "appointment" ? data.durationMins! : null;
  const availability = data.bookingMode === "appointment" ? (data.availability ?? {}) : undefined;

  const svcSlug = await uniqueServiceSlug(access.store.id, data.name);
  const service = await prisma.service.create({
    data: {
      storeId: access.store.id,
      categoryId: data.categoryId || null,
      name: data.name,
      slug: svcSlug,
      description: data.description,
      price: data.price,
      currency: data.currency,
      images: data.images,
      isBookable,
      durationMins,
      availability,
      isPublished: data.isPublished,
      totalUnits,
      attributes: data.attributes ?? {},
    },
  });

  if (totalUnits) {
    await prisma.serviceUnit.createMany({
      data: Array.from({ length: totalUnits }, (_, i) => ({
        storeId: access.store.id,
        serviceId: service.id,
        label: String(i + 1),
      })),
    });
  }

  revalidatePath(`/store/${slug}/admin/services`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: { id: service.id } };
}

export async function updateService(slug: string, serviceId: string, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const existing = await prisma.service.findFirst({ where: { id: serviceId, storeId: access.store.id } });
  if (!existing) return { success: false, error: "Service not found." };

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, storeId: access.store.id }, select: { id: true } });
    if (!category) return { success: false, error: "Category does not belong to this store." };
  }

  if (data.bookingMode === "appointment" && !data.durationMins) {
    return { success: false, error: "Bookable services need a duration." };
  }
  if (data.bookingMode === "units" && !data.totalUnits) {
    return { success: false, error: "Set the number of units for this service." };
  }

  const totalUnits = data.bookingMode === "units" ? data.totalUnits! : null;
  const isBookable = data.bookingMode !== "none";
  const durationMins = data.bookingMode === "appointment" ? data.durationMins! : null;
  const availability =
    data.bookingMode === "appointment"
      ? (data.availability ?? {})
      : existing.availability === null
        ? Prisma.JsonNull
        : (existing.availability as Prisma.InputJsonValue);

  // Reconcile ServiceUnit rows with the new count. Growing is always safe
  // (just add more units). Shrinking only removes units that have no
  // bookings attached -- if there aren't enough "free" units to remove,
  // we refuse rather than silently orphaning a booking.
  if (totalUnits !== existing.totalUnits) {
    const currentUnits = await prisma.serviceUnit.findMany({
      where: { serviceId },
      orderBy: { label: "desc" },
      select: { id: true, label: true, _count: { select: { bookings: true } } },
    });

    const currentCount = currentUnits.length;
    const targetCount = totalUnits ?? 0;

    if (targetCount > currentCount) {
      const existingLabels = new Set(currentUnits.map((u) => u.label));
      let next = currentCount + 1;
      const toCreate: { storeId: string; serviceId: string; label: string }[] = [];
      while (toCreate.length < targetCount - currentCount) {
        const label = String(next);
        if (!existingLabels.has(label)) toCreate.push({ storeId: access.store.id, serviceId, label });
        next++;
      }
      await prisma.serviceUnit.createMany({ data: toCreate });
    } else if (targetCount < currentCount) {
      const removable = currentUnits.filter((u) => u._count.bookings === 0);
      const removeCount = currentCount - targetCount;
      if (removable.length < removeCount) {
        return { success: false, error: `Can't reduce to ${targetCount} units — ${currentCount - removable.length} existing unit(s) have bookings attached.` };
      }
      const idsToRemove = removable.slice(0, removeCount).map((u) => u.id);
      await prisma.serviceUnit.deleteMany({ where: { id: { in: idsToRemove } } });
    }
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      categoryId: data.categoryId || null,
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency,
      images: data.images,
      isBookable,
      durationMins,
      availability,
      isPublished: data.isPublished,
      totalUnits,
      attributes: data.attributes ?? {},
    },
  });

  revalidatePath(`/store/${slug}/admin/services`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: { id: serviceId } };
}

export async function deleteService(slug: string, serviceId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const existing = await prisma.service.findFirst({ where: { id: serviceId, storeId: access.store.id } });
  if (!existing) return { success: false, error: "Service not found." };

  await prisma.service.delete({ where: { id: serviceId } });

  revalidatePath(`/store/${slug}/admin/services`);
  return { success: true, data: undefined };
}

export async function updateServiceAvailabilityForm(slug: string, serviceId: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const service = await prisma.service.findFirst({ where: { id: serviceId, storeId: access.store.id } });
  if (!service) return { success: false, error: "Service not found." };

  const durationMins = Number(formData.get("durationMins") ?? 0) || null;
  const availability = parseAvailability(formData);

  await prisma.service.update({
    where: { id: serviceId },
    data: { isBookable: true, durationMins, availability },
  });

  revalidatePath(`/store/${slug}/admin/services`);
  return { success: true, data: undefined };
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function parseAvailability(formData: FormData) {
  const out: Record<string, [string, string][]> = {};
  for (const day of DAYS) {
    if (formData.get(`${day}-enabled`) !== "on") continue;
    const start = String(formData.get(`${day}-start`) ?? "");
    const end = String(formData.get(`${day}-end`) ?? "");
    if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && start < end) {
      out[day] = [[start, end]];
    }
  }
  return out;
}
