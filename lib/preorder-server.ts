import "server-only";
import { prisma } from "@/lib/prisma";
import { PREORDER_UNCOUNTED_STATUSES } from "@/lib/preorder";
import { TRANSFER_HOLD_HOURS } from "@/lib/payments/stock-holds";

/**
 * Pre-order units already taken for a product: every non-cancelled, non-refunded order line flagged
 * as a pre-order. Unpaid orders only count while they're still live (same window as bank-transfer
 * stock holds), so abandoned checkouts don't eat the cap forever.
 */
export async function preorderUnitsTaken(productId: string, db: Pick<typeof prisma, "orderItem"> = prisma): Promise<number> {
  const liveSince = new Date(Date.now() - TRANSFER_HOLD_HOURS * 3_600_000);
  const r = await db.orderItem.aggregate({
    _sum: { quantity: true },
    where: {
      productId, preorder: true,
      order: {
        status: { notIn: [...PREORDER_UNCOUNTED_STATUSES] },
        OR: [{ status: { not: "PENDING_PAYMENT" } }, { createdAt: { gte: liveSince } }, { paymentProofUrl: { not: null } }],
      },
    },
  });
  return r._sum.quantity ?? 0;
}
