import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { settleAndPayout } from "@/lib/payments/payout";
import { amountCoversExpected } from "@/lib/payments/amount";
import { postPaymentToLedgerByReference } from "@/lib/financial/order-ledger";
import { notifyUser } from "@/lib/notifications/notify";
import { logError, logWarn } from "@/lib/observability/log";
import { formatMoney } from "@/lib/utils/format-money";
import { markTicketOrderPaid } from "@/lib/payments/ticket-receipt";
import { sendTicketEmail } from "@/lib/payments/ticket-confirmation";
import { ticketsPagePath } from "@/lib/tickets";
import type { ActionResult } from "@/types/actions";

/**
 * Ticket settlement (a buyer paying for an order of tickets).
 * Lives outside "use server" files on purpose: it takes caller-supplied amounts, so only the webhook, callback,
 * reconciliation and manual-transfer paths may import it.
 *
 * Tickets are created exactly once per gateway reference. If the order is no longer PENDING (it expired and its seats
 * were released, or staff already recorded the sale), nothing is issued and the payment is flagged so it can be refunded.
 */
export async function settleTicketPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY" | "CASH",
  verifiedAmount: number,
  rawPayload: object,
  verifiedCurrency?: string | null
): Promise<ActionResult<{ storeSlug: string; redirectPath: string }>> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { ticketOrder: { include: { event: { select: { title: true } }, store: { select: { id: true, slug: true, business: { select: { user: { select: { id: true } } } } } } } } },
  });
  if (!payment || payment.purpose !== "TICKET_PURCHASE" || !payment.ticketOrder) return { success: false, error: "Ticket payment not found." };
  const order = payment.ticketOrder;
  const slug = order.store.slug;
  const redirectPath = ticketsPagePath(slug, order.accessToken);
  const ok = { storeSlug: slug, redirectPath };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: ok };
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return { success: false, error: "Ticket payment is not pending." };

  if (provider !== "CASH") {
    const cur = verifiedCurrency ? verifiedCurrency.toUpperCase() : "NGN";
    if (cur !== "NGN") return { success: false, error: "Payment currency mismatch." };
  }
  if (!amountCoversExpected(Number(verifiedAmount), Number(payment.amount))) return { success: false, error: "Payment amount mismatch." };

  let settledNow = false;
  let applied = false;
  await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() } });
    if (claim.count === 0) return;
    settledNow = true;
    const receiptNo = await markTicketOrderPaid(tx, { orderId: order.id, storeId: order.storeId, method: provider === "CASH" ? "TRANSFER" : "CARD", reference, note: "Paid online" });
    applied = receiptNo !== null;
    if (!applied) {
      await tx.payment.update({ where: { id: payment.id }, data: { rawPayload: { verification: rawPayload, overpaid: Number(payment.amount), note: "Order was no longer open (expired or already paid). Refund this payment." } as object } });
    }
  });

  if (settledNow && !applied) void logWarn("PAYMENTS", "Ticket payment arrived for an order that was not open. Refund it.", { reference, orderId: order.id });

  await postPaymentToLedgerByReference(reference);
  await settleAndPayout(reference);

  if (settledNow && applied) await Promise.allSettled([sendTicketEmail(reference)]);
  const ownerId = order.store.business?.user?.id;
  if (settledNow && ownerId) {
    try {
      await notifyUser({
        userId: ownerId, type: "TICKET_PURCHASE",
        title: applied ? `Tickets sold: ${order.event.title}` : `Refund needed: tickets for ${order.event.title}`,
        body: applied ? `${order.buyerName} paid ${formatMoney(Number(payment.amount), "NGN")}.` : `${formatMoney(Number(payment.amount), "NGN")} arrived for an order that had expired. Refund it.`,
        url: `/store/${slug}/admin/tickets`,
      });
    } catch (err) {
      void logError("PAYMENTS", "Could not notify store of ticket sale", { reference, error: String(err) });
    }
  }

  revalidatePath(`/store/${slug}/admin/tickets`);
  revalidatePath(redirectPath);
  return { success: true, data: ok };
}
