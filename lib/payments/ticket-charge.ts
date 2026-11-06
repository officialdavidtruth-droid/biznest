import "server-only";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import { shortToken } from "@/lib/payments/reference";
import { TICKET_PAY_PREFIX, TICKET_MIN_ONLINE_PAYMENT } from "@/lib/tickets";

type ChargeStore = { id: string; slug: string; customDomain: string | null; customDomainStatus: string };

/**
 * Starts payment of one ticket order and returns where to send the buyer: the gateway checkout, or the store's
 * bank-transfer page when the store has no gateway. The caller has already authorised the buyer (they hold
 * the public event page) and confirmed the order is PENDING. The amount is always the charge's full amount.
 */
export async function startTicketCharge(input: {
  store: ChargeStore; orderId: string; amount: number; buyerName: string; buyerEmail?: string | null;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const { store, orderId, amount } = input;
  if (!Number.isFinite(amount) || amount < TICKET_MIN_ONLINE_PAYMENT) return { success: false, error: `Online payment starts at ${TICKET_MIN_ONLINE_PAYMENT}. Please contact the organiser.` };

  // A handful of unpaid attempts is normal (abandoned checkouts); beyond that something is wrong.
  const open = await prisma.payment.count({ where: { ticketOrderId: orderId, purpose: "TICKET_PURCHASE", status: "PENDING", provider: { not: "CASH" } } });
  if (open >= 5) return { success: false, error: "Too many unfinished payment attempts. Please contact the organiser." };

  const route = await resolvePayRoute(store.id);
  if (route.mode === "error") return { success: false, error: route.error };
  if (route.mode === "manual") {
    const { payUrl } = await startManualTransfer({ store, purpose: "TICKET_PURCHASE", entityId: orderId, amount, currency: "NGN", ticketOrderId: orderId });
    return { success: true, url: payUrl };
  }

  const checkout = await resolveCheckoutGateway(store.id);
  if (!checkout.ok) return { success: false, error: checkout.error };

  const reference = `${TICKET_PAY_PREFIX}-${orderId}-${shortToken()}`;
  await createPendingPayment({ storeId: store.id, ticketOrderId: orderId, purpose: "TICKET_PURCHASE", provider: checkout.gateway, reference, amount, currency: "NGN", usesStoreGateway: checkout.usesStoreGateway });

  const charge = await chargeCustomer({
    email: input.buyerEmail?.trim() || "buyer@biznest.space", customerName: input.buyerName, amountNaira: amount, currency: "NGN", reference,
    callbackUrl: paymentCallbackUrl(checkout.gateway), storeId: store.id,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });
  return { success: true, url: charge.authorizationUrl };
}
