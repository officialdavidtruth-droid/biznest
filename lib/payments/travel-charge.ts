import "server-only";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import { shortToken } from "@/lib/payments/reference";
import { TRAVEL_PAY_PREFIX, canPayOnline } from "@/lib/travel";

type ChargeStore = { id: string; slug: string; customDomain: string | null; customDomainStatus: string; paystackSubaccountCode?: string | null; flutterwaveSubaccountId?: string | null };

/**
 * Starts an online payment for part of a trip and returns where to send the payer.
 * Gateway checkout when the platform or the store has a gateway, otherwise the store's bank-transfer page.
 * Caller is responsible for authorisation and for choosing a sensible amount (see callers).
 */
export async function startTravelCharge(input: {
  store: ChargeStore; tripId: string; amountNaira: number; currency: string; email?: string | null; customerName: string;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const { store, tripId, amountNaira } = input;
  if (!canPayOnline(input.currency)) return { success: false, error: "Online payment is only available for trips priced in NGN." };
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) return { success: false, error: "Enter a valid amount." };

  // A handful of unpaid attempts is normal (abandoned checkouts); beyond that something is wrong.
  const openAttempts = await prisma.payment.count({ where: { travelTripId: tripId, purpose: "TRAVEL_BOOKING", status: "PENDING", provider: { not: "CASH" } } });
  if (openAttempts >= 5) return { success: false, error: "Too many unfinished payment attempts for this booking. Please contact the agency." };

  const route = await resolvePayRoute(store.id);
  if (route.mode === "error") return { success: false, error: route.error };
  if (route.mode === "manual") {
    const { payUrl } = await startManualTransfer({ store, purpose: "TRAVEL_BOOKING", entityId: tripId, amount: amountNaira, currency: "NGN", travelTripId: tripId });
    return { success: true, url: payUrl };
  }

  const checkout = await resolveCheckoutGateway(store.id);
  if (!checkout.ok) return { success: false, error: checkout.error };
  const reference = `${TRAVEL_PAY_PREFIX}-${tripId}-${shortToken()}`;
  await createPendingPayment({ storeId: store.id, travelTripId: tripId, purpose: "TRAVEL_BOOKING", provider: checkout.gateway, reference, amount: amountNaira, currency: "NGN", usesStoreGateway: checkout.usesStoreGateway });

  const charge = await chargeCustomer({
    email: input.email?.trim() || "traveller@biznest.space", customerName: input.customerName, amountNaira, reference,
    callbackUrl: paymentCallbackUrl(checkout.gateway), storeId: store.id,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });
  return { success: true, url: charge.authorizationUrl };
}
