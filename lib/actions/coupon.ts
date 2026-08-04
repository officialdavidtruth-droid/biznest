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

export async function createCoupon(slug: string, formData: FormData) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return;

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const discountType = String(formData.get("discountType") ?? "PERCENT");
  const discountValue = Number(formData.get("discountValue") ?? 0);
  const maxUsesRaw = formData.get("maxUses");
  const maxUses = maxUsesRaw && String(maxUsesRaw).length > 0 ? Number(maxUsesRaw) : null;

  if (!code || !(discountValue > 0)) return;

  await prisma.coupon.create({
    data: {
      storeId: access.store.id,
      code,
      discountType,
      discountValue,
      maxUses,
    },
  });

  revalidatePath(`/store/${slug}/admin/coupons`);
}
