"use server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";

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

/**
 * Customer-facing coupon check for the booking wizard's promo code field.
 * No store-access gate — this runs for anonymous/guest shoppers. Returns
 * the discount to preview client-side; like the booking wizard's add-ons
 * (see BookableAddon's comment in booking-flow-wizard.tsx), the discount
 * is NOT sent to payment — it's appended to the booking notes so staff can
 * apply it manually, keeping the amount charged equal to the
 * server-verified room/unit total.
 *
 * Coupon.usedCount isn't incremented here on purpose: nothing in the
 * platform increments it at actual redemption yet (product-order coupons
 * have the same gap), so treating a "check" as a "use" would make coupons
 * appear exhausted from previews alone. Wiring real redemption tracking is
 * a follow-up, not something to fake here.
 */
export async function validateBookingCoupon(
  slug: string,
  code: string,
  subtotal: number
): Promise<ActionResult<{ code: string; discountLabel: string; discountAmount: number }>> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { success: false, error: "Enter a promo code." };

  const rate = await checkRateLimit(`coupon-check:${slug}`, 30, 10 * 60 * 1000);
  if (!rate.allowed) return { success: false, error: "Too many attempts — try again shortly." };

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return { success: false, error: "Store not found." };

  const coupon = await prisma.coupon.findUnique({ where: { storeId_code: { storeId: store.id, code: trimmed } } });
  if (!coupon || !coupon.isActive) return { success: false, error: "That promo code isn't valid." };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { success: false, error: "That promo code has expired." };
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return { success: false, error: "That promo code has been fully redeemed." };

  const discountValue = Number(coupon.discountValue);
  const discountAmount =
    coupon.discountType === "PERCENT"
      ? Math.round((subtotal * discountValue) / 100)
      : Math.round(Math.min(discountValue, subtotal));

  const discountLabel = coupon.discountType === "PERCENT" ? `${discountValue}% off` : `₦${discountValue.toLocaleString()} off`;

  return { success: true, data: { code: trimmed, discountLabel, discountAmount } };
}
