import "server-only";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import { shortToken } from "@/lib/payments/reference";
import { JOB_PAY_PREFIX, JOB_MIN_ONLINE_PAYMENT } from "@/lib/jobs";

type ChargeStore = { id: string; slug: string; customDomain: string | null; customDomainStatus: string };

/**
 * Starts payment of one job charge and returns where to send the customer: the gateway checkout, or the store's
 * bank-transfer page when the store has no gateway. The caller has already authorised the customer (they hold
 * their secret job link) and confirmed the charge is DUE. The amount is always the charge's full amount.
 */
export async function startJobCharge(input: {
  store: ChargeStore; chargeId: string; amount: number; customerName: string; customerEmail?: string | null;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const { store, chargeId, amount } = input;
  if (!Number.isFinite(amount) || amount < JOB_MIN_ONLINE_PAYMENT) return { success: false, error: `Online payment starts at ${JOB_MIN_ONLINE_PAYMENT}. Please pay the business directly.` };

  // A handful of unpaid attempts is normal (abandoned checkouts); beyond that something is wrong.
  const open = await prisma.payment.count({ where: { jobChargeId: chargeId, purpose: "JOB_PAYMENT", status: "PENDING", provider: { not: "CASH" } } });
  if (open >= 5) return { success: false, error: "Too many unfinished payment attempts. Please contact the business." };

  const route = await resolvePayRoute(store.id);
  if (route.mode === "error") return { success: false, error: route.error };
  if (route.mode === "manual") {
    const { payUrl } = await startManualTransfer({ store, purpose: "JOB_PAYMENT", entityId: chargeId, amount, currency: "NGN", jobChargeId: chargeId });
    return { success: true, url: payUrl };
  }

  const checkout = await resolveCheckoutGateway(store.id);
  if (!checkout.ok) return { success: false, error: checkout.error };

  const reference = `${JOB_PAY_PREFIX}-${chargeId}-${shortToken()}`;
  await createPendingPayment({ storeId: store.id, jobChargeId: chargeId, purpose: "JOB_PAYMENT", provider: checkout.gateway, reference, amount, currency: "NGN", usesStoreGateway: checkout.usesStoreGateway });

  const charge = await chargeCustomer({
    email: input.customerEmail?.trim() || "customer@biznest.space", customerName: input.customerName, amountNaira: amount, currency: "NGN", reference,
    callbackUrl: paymentCallbackUrl(checkout.gateway), storeId: store.id,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });
  return { success: true, url: charge.authorizationUrl };
}
