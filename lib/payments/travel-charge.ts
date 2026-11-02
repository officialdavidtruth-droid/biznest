import "server-only";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import { shortToken } from "@/lib/payments/reference";
import { resolveStoreGateway } from "@/lib/payments/store-gateway";
import { TRAVEL_PAY_PREFIX, canPayOnline, gatewayCurrencyError } from "@/lib/travel";

type ChargeStore = { id: string; slug: string; customDomain: string | null; customDomainStatus: string; paystackSubaccountCode?: string | null; flutterwaveSubaccountId?: string | null };

/**
 * Can this store take online payment for a trip in this currency? Returns an error message or null.
 * NGN works on any route. Any other currency needs the store's OWN Paystack/Flutterwave keys (the money
 * goes straight to the agency; BizNest's NGN gateways and payouts are never involved).
 */
export async function travelOnlinePaymentError(storeId: string, currency: string): Promise<string | null> {
  const cur = String(currency ?? "").toUpperCase();
  if (!canPayOnline(cur)) return `Online payment isn't available for ${cur || "this currency"}.`;
  if (cur === "NGN") return null;
  const own = await resolveStoreGateway(storeId);
  if (own.status === "error") return own.message;
  if (own.status !== "ok") return `Online payment in ${cur} needs your own Paystack or Flutterwave keys (Payments settings). BizNest's gateways settle in NGN only.`;
  return gatewayCurrencyError(cur, own.credentials.provider);
}

/**
 * Starts an online payment for part of a trip and returns where to send the payer.
 * Gateway checkout when the platform or the store has a gateway, otherwise the store's bank-transfer page.
 * Caller is responsible for authorisation and for choosing a sensible amount (see callers).
 */
export async function startTravelCharge(input: {
  store: ChargeStore; tripId: string; amountNaira: number; currency: string; email?: string | null; customerName: string;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const { store, tripId, amountNaira } = input;
  const currency = String(input.currency ?? "").toUpperCase();
  const unavailable = await travelOnlinePaymentError(store.id, currency);
  if (unavailable) return { success: false, error: unavailable };
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) return { success: false, error: "Enter a valid amount." };

  // A handful of unpaid attempts is normal (abandoned checkouts); beyond that something is wrong.
  const openAttempts = await prisma.payment.count({ where: { travelTripId: tripId, purpose: "TRAVEL_BOOKING", status: "PENDING", provider: { not: "CASH" } } });
  if (openAttempts >= 5) return { success: false, error: "Too many unfinished payment attempts for this booking. Please contact the agency." };

  const route = await resolvePayRoute(store.id);
  if (route.mode === "error") return { success: false, error: route.error };
  if (route.mode === "manual") {
    const { payUrl } = await startManualTransfer({ store, purpose: "TRAVEL_BOOKING", entityId: tripId, amount: amountNaira, currency, travelTripId: tripId });
    return { success: true, url: payUrl };
  }

  const checkout = await resolveCheckoutGateway(store.id);
  if (!checkout.ok) return { success: false, error: checkout.error };
  const reference = `${TRAVEL_PAY_PREFIX}-${tripId}-${shortToken()}`;
  await createPendingPayment({ storeId: store.id, travelTripId: tripId, purpose: "TRAVEL_BOOKING", provider: checkout.gateway, reference, amount: amountNaira, currency, usesStoreGateway: checkout.usesStoreGateway });

  const charge = await chargeCustomer({
    email: input.email?.trim() || "traveller@biznest.space", customerName: input.customerName, amountNaira, currency, reference,
    callbackUrl: paymentCallbackUrl(checkout.gateway), storeId: store.id,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });
  return { success: true, url: charge.authorizationUrl };
}
