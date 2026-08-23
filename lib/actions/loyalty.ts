"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { getLoyaltyRates } from "@/lib/actions/site-settings";
import { roundMoney } from "@/lib/utils/pricing";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { LoyaltyEntry } from "@prisma/client";

// --- Reads (customer-facing) --------------------------------------------

/**
 * Stores a customer can plausibly cash out points at — anywhere they've
 * ordered from or follow as a favorite, deduplicated. Redemption isn't
 * restricted to only these (a store lookup by id still works elsewhere),
 * this is just what's offered as quick-pick options in the cash-out form.
 */
export async function listRedeemableStores(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "CUSTOMER") return [];

  const [orderedStores, favoriteStores] = await Promise.all([
    prisma.store.findMany({
      where: { orders: { some: { buyerId: session.user.id } } },
      select: { id: true, name: true },
    }),
    prisma.store.findMany({
      where: { business: { favoritedBy: { some: { userId: session.user.id } } } },
      select: { id: true, name: true },
    }),
  ]);

  const seen = new Map<string, string>();
  for (const s of [...orderedStores, ...favoriteStores]) seen.set(s.id, s.name);
  return Array.from(seen, ([id, name]) => ({ id, name }));
}

/**
 * A customer's current points balance and recent ledger entries. Creates no
 * rows -- returns a zero balance for customers who've never earned points
 * rather than lazily creating a LoyaltyAccount on every read.
 */
export async function getLoyaltySummary(): Promise<{
  pointsBalance: number;
  entries: LoyaltyEntry[];
  rates: { pointsPerNaira: number; nairaPerPoint: number };
}> {
  const session = await auth();
  const rates = await getLoyaltyRates();
  if (!session?.user?.id) return { pointsBalance: 0, entries: [], rates };
  if (session.user.role === "CUSTOMER") return { pointsBalance: 0, entries: [], rates };

  const account = await prisma.loyaltyAccount.findUnique({
    where: { userId: session.user.id },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 50 } },
  });

  return {
    pointsBalance: account?.pointsBalance ?? 0,
    entries: account?.entries ?? [],
    rates,
  };
}

// --- Earning (system-triggered) -----------------------------------------

/**
 * Awards points for a completed order at the current global rate. Called
 * from lib/actions/order.ts:updateOrderStatus when an order transitions to
 * COMPLETED -- never call this directly from a client action, since it's
 * not guarded by its own auth check (the caller has already verified the
 * order legitimately completed).
 *
 * Idempotent: if this order already has an EARN entry, it's a no-op, so a
 * retried status update (or a future webhook replay) can't double-credit
 * points.
 */
export async function awardLoyaltyPointsForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const alreadyAwarded = await prisma.loyaltyEntry.findFirst({
    where: { orderId, type: "EARN" },
  });
  if (alreadyAwarded) return;

  const rates = await getLoyaltyRates();
  const points = Math.floor(Number(order.subtotal) * rates.pointsPerNaira);
  if (points <= 0) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.loyaltyAccount.upsert({
      where: { userId: order.buyerId },
      create: { userId: order.buyerId, pointsBalance: 0 },
      update: {},
    });

    await tx.loyaltyEntry.create({
      data: {
        loyaltyAccountId: account.id,
        orderId: order.id,
        type: "EARN",
        points,
      },
    });

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { pointsBalance: { increment: points } },
    });
  });
}

// --- Cash-out (customer-facing) ------------------------------------------

/**
 * Redeems points for a store-scoped Coupon. There is no auto-apply at
 * checkout -- redemption always goes through this explicit action, and the
 * resulting coupon is only valid at the store the customer chose, per
 * product decision (loyalty is platform-wide to earn, but redemption stays
 * tied to a single merchant so it visibly benefits the store the customer
 * is shopping with).
 */
export async function cashOutLoyaltyPoints(
  storeId: string,
  pointsToRedeem: number
): Promise<ActionResult<{ couponCode: string; discountValue: number }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in to cash out points." };
  if (session.user.role === "CUSTOMER") return { success: false, error: "Customer rewards are store-specific." };

  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
    return { success: false, error: "Enter a whole number of points to cash out." };
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return { success: false, error: "Store not found." };

  const account = await prisma.loyaltyAccount.findUnique({ where: { userId: session.user.id } });
  if (!account || account.pointsBalance < pointsToRedeem) {
    return { success: false, error: "You don't have enough points for that." };
  }

  const rates = await getLoyaltyRates();
  const discountValue = roundMoney(pointsToRedeem * rates.nairaPerPoint);
  if (discountValue <= 0) return { success: false, error: "That's not enough points to redeem yet." };

  // Short, readable, and collision-resistant enough for a per-store unique
  // code -- matches the manual codes merchants type in via settings-forms.tsx.
  const couponCode = `LOYALTY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });
    if (!fresh || fresh.pointsBalance < pointsToRedeem) {
      throw new Error("INSUFFICIENT_POINTS");
    }

    await tx.loyaltyEntry.create({
      data: {
        loyaltyAccountId: account.id,
        type: "REDEEM",
        points: -pointsToRedeem,
        note: `Cashed out at ${store.name}`,
      },
    });

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { pointsBalance: { decrement: pointsToRedeem } },
    });

    const coupon = await tx.coupon.create({
      data: {
        storeId: store.id,
        code: couponCode,
        discountType: "FIXED",
        discountValue,
        maxUses: 1,
      },
    });

    return coupon;
  }).catch((err) => {
    if (err instanceof Error && err.message === "INSUFFICIENT_POINTS") return null;
    throw err;
  });

  if (!result) return { success: false, error: "You don't have enough points for that." };

  revalidatePath("/account/loyalty");
  return { success: true, data: { couponCode: result.code, discountValue: Number(result.discountValue) } };
}

// Store-scoped customer loyalty. The legacy platform-wide loyalty functions
// above remain available for existing merchant/admin tooling, but the
// customer experience under /store/[slug]/account only uses these functions.
export async function getStoreLoyaltySummary(storeSlug: string) {
  const session = await auth();
  const rates = await getLoyaltyRates();
  if (!session?.user?.id) return null;
  const account = await prisma.storeLoyaltyAccount.findFirst({
    where: { userId: session.user.id, store: { slug: storeSlug } },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  return { pointsBalance: account?.pointsBalance ?? 0, entries: account?.entries ?? [], rates };
}

export async function awardStoreLoyaltyPointsForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  const alreadyAwarded = await prisma.storeLoyaltyEntry.findFirst({ where: { orderId, type: "EARN" } });
  if (alreadyAwarded) return;
  const rates = await getLoyaltyRates();
  const points = Math.floor(Number(order.subtotal) * rates.pointsPerNaira);
  if (points <= 0) return;
  await prisma.$transaction(async (tx) => {
    const account = await tx.storeLoyaltyAccount.upsert({
      where: { storeId_userId: { storeId: order.storeId, userId: order.buyerId } },
      create: { storeId: order.storeId, userId: order.buyerId, pointsBalance: 0 },
      update: {},
    });
    await tx.storeLoyaltyEntry.create({ data: { loyaltyAccountId: account.id, orderId: order.id, type: "EARN", points } });
    await tx.storeLoyaltyAccount.update({ where: { id: account.id }, data: { pointsBalance: { increment: points } } });
  });
}

export async function cashOutStoreLoyaltyPoints(storeSlug: string, pointsToRedeem: number): Promise<ActionResult<{ couponCode: string; discountValue: number }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Please sign in to redeem rewards." };
  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) return { success: false, error: "Enter a whole number of points." };
  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true, name: true } });
  if (!store) return { success: false, error: "Store not found." };
  const membership = await requireStoreCustomer(storeSlug);
  if (!membership) return { success: false, error: "You don't have a customer account with this store." };
  const account = await prisma.storeLoyaltyAccount.findUnique({ where: { storeId_userId: { storeId: store.id, userId: session.user.id } } });
  if (!account || account.pointsBalance < pointsToRedeem) return { success: false, error: "You don't have enough points for that." };
  const rates = await getLoyaltyRates();
  const discountValue = roundMoney(pointsToRedeem * rates.nairaPerPoint);
  if (discountValue <= 0) return { success: false, error: "That's not enough points to redeem yet." };
  const couponCode = `LOYALTY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.storeLoyaltyAccount.findUnique({ where: { id: account.id } });
    if (!fresh || fresh.pointsBalance < pointsToRedeem) throw new Error("INSUFFICIENT_POINTS");
    await tx.storeLoyaltyEntry.create({ data: { loyaltyAccountId: account.id, type: "REDEEM", points: -pointsToRedeem, note: `Redeemed at ${store.name}` } });
    await tx.storeLoyaltyAccount.update({ where: { id: account.id }, data: { pointsBalance: { decrement: pointsToRedeem } } });
    return tx.coupon.create({ data: { storeId: store.id, code: couponCode, discountType: "FIXED", discountValue, maxUses: 1 } });
  }).catch((err) => err instanceof Error && err.message === "INSUFFICIENT_POINTS" ? null : Promise.reject(err));
  if (!result) return { success: false, error: "You don't have enough points for that." };
  revalidatePath(`/store/${storeSlug}/account/loyalty`);
  return { success: true, data: { couponCode: result.code, discountValue: Number(result.discountValue) } };
}
