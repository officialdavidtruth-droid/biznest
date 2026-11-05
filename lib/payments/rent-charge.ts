import "server-only";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import { shortToken } from "@/lib/payments/reference";
import { RENT_PAY_PREFIX, RENT_MIN_ONLINE_PAYMENT } from "@/lib/real-estate";

type ChargeStore = { id: string; slug: string; customDomain: string | null; customDomainStatus: string };

/**
 * Starts payment of one rent charge and returns where to send the tenant: the gateway checkout, or the store's
 * bank-transfer page when the landlord has no gateway. The caller has already authorised the tenant (they hold
 * the unit's secret portal link) and confirmed the charge is DUE. The amount is always the charge's full amount.
 */
export async function startRentCharge(input: {
  store: ChargeStore; chargeId: string; amount: number; tenantName: string; tenantEmail?: string | null;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const { store, chargeId, amount } = input;
  if (!Number.isFinite(amount) || amount < RENT_MIN_ONLINE_PAYMENT) return { success: false, error: `Online payment starts at ${RENT_MIN_ONLINE_PAYMENT}. Please pay the landlord directly.` };

  // A handful of unpaid attempts is normal (abandoned checkouts); beyond that something is wrong.
  const open = await prisma.payment.count({ where: { rentChargeId: chargeId, purpose: "RENT_PAYMENT", status: "PENDING", provider: { not: "CASH" } } });
  if (open >= 5) return { success: false, error: "Too many unfinished payment attempts. Please contact your landlord." };

  const route = await resolvePayRoute(store.id);
  if (route.mode === "error") return { success: false, error: route.error };
  if (route.mode === "manual") {
    const { payUrl } = await startManualTransfer({ store, purpose: "RENT_PAYMENT", entityId: chargeId, amount, currency: "NGN", rentChargeId: chargeId });
    return { success: true, url: payUrl };
  }

  const checkout = await resolveCheckoutGateway(store.id);
  if (!checkout.ok) return { success: false, error: checkout.error };

  const reference = `${RENT_PAY_PREFIX}-${chargeId}-${shortToken()}`;
  await createPendingPayment({ storeId: store.id, rentChargeId: chargeId, purpose: "RENT_PAYMENT", provider: checkout.gateway, reference, amount, currency: "NGN", usesStoreGateway: checkout.usesStoreGateway });

  const charge = await chargeCustomer({
    email: input.tenantEmail?.trim() || "tenant@biznest.space", customerName: input.tenantName, amountNaira: amount, currency: "NGN", reference,
    callbackUrl: paymentCallbackUrl(checkout.gateway), storeId: store.id,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });
  return { success: true, url: charge.authorizationUrl };
}
