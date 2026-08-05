"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import slugify from "slugify";
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

async function uniqueServiceSlug(storeId: string, base: string): Promise<string> {
  const root = slugify(base, { lower: true, strict: true }) || "service";
  let candidate = root;
  let n = 1;
  while (await prisma.service.findFirst({ where: { storeId, slug: candidate } })) {
    candidate = `${root}-${++n}`;
  }
  return candidate;
}

export async function createService(slug: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const isBookable = formData.get("isBookable") === "on";
  const durationMins = isBookable ? Number(formData.get("durationMins") ?? 0) || null : null;
  const isPublished = formData.get("isPublished") === "on";

  if (!name || name.length < 2) return { success: false, error: "Give the service a name." };
  if (!(price >= 0)) return { success: false, error: "Enter a valid price." };
  if (isBookable && !durationMins) return { success: false, error: "Bookable services need a duration." };

  const availability = isBookable ? parseAvailability(formData) : undefined;

  const svcSlug = await uniqueServiceSlug(access.store.id, name);
  const service = await prisma.service.create({
    data: {
      storeId: access.store.id,
      categoryId,
      name,
      slug: svcSlug,
      description,
      price,
      isBookable,
      durationMins,
      availability,
      isPublished,
    },
  });

  revalidatePath(`/store/${slug}/admin/services`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: { id: service.id } };
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
