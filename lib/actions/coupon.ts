"use server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// "marketing" permission — see product.ts's assertStoreAccess for why this
// delegates to assertStorePermission instead of the old owner-only check.
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "marketing");
}

export async function createCoupon(slug: string, formData: FormData) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return;

  // Loose backstop (this is already store-owner-gated) against a runaway
  // script rather than a real abuse vector.
  const rate = await checkRateLimit(`coupon-create:${access.store.id}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) return;

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
