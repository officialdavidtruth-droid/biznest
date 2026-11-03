import "server-only";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import { shortToken } from "@/lib/payments/reference";
import { resolveStoreGateway } from "@/lib/payments/store-gateway";
import { canPayOnline, gatewayCurrencyError } from "@/lib/travel";
import { TAILORING_PAY_PREFIX } from "@/lib/tailoring";

type ChargeStore = { id: string; slug: string; customDomain: string | null; customDomainStatus: string };

/**
 * Can this store take a tailoring balance online in this currency? Returns an error message or null.
 * NGN works on any route. Any other currency needs the store's OWN Paystack/Flutterwave keys (the money goes
 * straight to the store; BizNest's NGN gateways and payouts are never involved). Same rule as trip payments.
 */
export async function tailoringOnlinePaymentError(storeId: string, currency: string): Promise<string | null> {
  const cur = String(currency ?? "").toUpperCase();
  if (!canPayOnline(cur)) return `Online payment isn't available for ${cur || "this currency"}.`;
  if (cur === "NGN") return null;
  const own = await resolveStoreGateway(storeId);
  if (own.status === "error") return own.message;
  if (own.status !== "ok") return `Online payment in ${cur} needs the store's own Paystack or Flutterwave keys.`;
  return gatewayCurrencyError(cur, own.credentials.provider);
}

/**
 * Starts an online payment toward a job's balance and returns where to send the customer: the gateway checkout, or
 * the store's bank-transfer page when the store has no gateway. The caller has already authorised the customer
 * (they hold the job's secret status link) and chosen a sensible amount.
 */
export async function startTailoringCharge(input: {
  store: ChargeStore; jobId: string; amount: number; currency: string; customerName: string;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const { store, jobId, amount } = input;
  const currency = String(input.currency ?? "").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter a valid amount." };

  // A handful of unpaid attempts is normal (abandoned checkouts); beyond that something is wrong.
  const open = await prisma.payment.count({ where: { tailoringJobId: jobId, purpose: "TAILORING_BALANCE", status: "PENDING", provider: { not: "CASH" } } });
  if (open >= 5) return { success: false, error: "Too many unfinished payment attempts. Please contact the store." };

  const route = await resolvePayRoute(store.id);
  if (route.mode === "error") return { success: false, error: route.error };
  if (route.mode === "manual") {
    const { payUrl } = await startManualTransfer({ store, purpose: "TAILORING_BALANCE", entityId: jobId, amount, currency, tailoringJobId: jobId });
    return { success: true, url: payUrl };
  }

  const unavailable = await tailoringOnlinePaymentError(store.id, currency);
  if (unavailable) return { success: false, error: unavailable };
  const checkout = await resolveCheckoutGateway(store.id);
  if (!checkout.ok) return { success: false, error: checkout.error };

  const reference = `${TAILORING_PAY_PREFIX}-${jobId}-${shortToken()}`;
  await createPendingPayment({ storeId: store.id, tailoringJobId: jobId, purpose: "TAILORING_BALANCE", provider: checkout.gateway, reference, amount, currency, usesStoreGateway: checkout.usesStoreGateway });

  const charge = await chargeCustomer({
    email: "customer@biznest.space", customerName: input.customerName, amountNaira: amount, currency, reference,
    callbackUrl: paymentCallbackUrl(checkout.gateway), storeId: store.id,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });
  return { success: true, url: charge.authorizationUrl };
}
