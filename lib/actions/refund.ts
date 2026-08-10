"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/payments/gateway";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

// Order statuses a refund can be issued from. PENDING_PAYMENT/CANCELLED
// never had money move; REFUNDED is already done; DISPUTED is left out
// deliberately — a disputed order should be resolved via the dispute flow
// first so there's a record of why, rather than refunded out from under it.
const REFUNDABLE_ORDER_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

async function assertStoreAccess(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };

  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false as const, error: "You don't have access to this store." };

  return { success: true as const, store, actorEmail: session.user.email ?? "unknown" };
}

/**
 * Manual "issue refund" action for support/admin use. Issues a full refund
 * against the order's successful Payment record through whichever gateway
 * actually processed the charge, then marks both the Payment and the Order
 * accordingly. There's no self-serve refund button for buyers or sellers —
 * this exists for support/admin to resolve disputes, cancellations, and
 * mistaken charges by hand.
 */
export async function issueRefund(
  slug: string,
  orderId: string,
  reason: string
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (!reason.trim()) {
    return { success: false, error: "A reason is required for the refund record." };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: access.store.id },
    include: { payments: true },
  });
  if (!order) return { success: false, error: "Order not found." };

  if (!REFUNDABLE_ORDER_STATUSES.includes(order.status as (typeof REFUNDABLE_ORDER_STATUSES)[number])) {
    return { success: false, error: `Orders in ${order.status.replace("_", " ").toLowerCase()} status can't be refunded from here.` };
  }

  const payment = order.payments.find((p) => p.purpose === "ORDER" && p.status === "SUCCESSFUL");
  if (!payment) {
    return { success: false, error: "No successful payment found for this order to refund." };
  }
  if (payment.status === "REFUNDED" || payment.refundedAt) {
    return { success: false, error: "This payment has already been refunded." };
  }

  // Flutterwave's refund endpoint takes their own numeric transaction id,
  // not our tx_ref (Payment.reference) — pull it back out of the raw
  // verification payload saved when the charge was confirmed.
  let gatewayTransactionRef = payment.reference;
  if (payment.provider === "FLUTTERWAVE") {
    const rawId = (payment.rawPayload as { data?: { id?: number } } | null)?.data?.id;
    if (!rawId) {
      return { success: false, error: "Missing Flutterwave transaction id on this payment — can't issue a gateway refund." };
    }
    gatewayTransactionRef = String(rawId);
  }

  const refund = await refundPayment({
    provider: payment.provider,
    gatewayTransactionRef,
    amountNaira: Number(payment.amount),
  });
  if (!refund.success) {
    return { success: false, error: refund.error };
  }

  // Idempotency guard mirrors the webhook/callback pattern elsewhere:
  // only transition a payment that's still SUCCESSFUL, via updateMany's
  // affected-row count, so a double-click or concurrent request can't
  // record two refunds (and can't call the gateway twice either, since
  // the earlier findFirst/refundedAt check above already screens most of
  // that — this is the last-line atomic guard on the DB write itself).
  const result = await prisma.payment.updateMany({
    where: { id: payment.id, status: "SUCCESSFUL" },
    data: {
      status: "REFUNDED",
      refundReference: refund.refundReference,
      refundedAmount: payment.amount,
      refundReason: reason.trim(),
      refundedByEmail: access.actorEmail,
      refundedAt: new Date(),
    },
  });
  if (result.count === 0) {
    return { success: false, error: "This payment was already refunded by another request." };
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
  await prisma.orderStatusEvent.create({ data: { orderId: order.id, status: "REFUNDED", note: reason.trim() } });

  await emitWebhookEvent("PAYMENT_REFUNDED", access.store.id, {
    orderId: order.id,
    paymentId: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    reason: reason.trim(),
  });

  revalidatePath(`/store/${slug}/admin/orders/${orderId}`);
  revalidatePath(`/store/${slug}/admin/orders`);
  revalidatePath(`/store/${slug}/admin/payments`);

  return { success: true, data: undefined };
}
