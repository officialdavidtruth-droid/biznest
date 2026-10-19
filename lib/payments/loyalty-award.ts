import "server-only";

import { prisma } from "@/lib/prisma";
import { getLoyaltyRates } from "@/lib/actions/site-settings";

/**
 * System-triggered loyalty awards (no auth check of their own).
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

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
