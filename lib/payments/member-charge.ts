import "server-only";
import { prisma } from "@/lib/prisma";
import { chargeCustomer, resolveCheckoutGateway, paymentCallbackUrl } from "@/lib/payments/gateway";
import { createPendingPayment, markPaymentFailed } from "@/lib/payments/pending";
import { resolvePayRoute, startManualTransfer } from "@/lib/payments/manual-flow";
import { shortToken } from "@/lib/payments/reference";
import { MEMBER_PAY_PREFIX, MEMBER_MIN_ONLINE_PAYMENT } from "@/lib/members";

type ChargeStore = { id: string; slug: string; customDomain: string | null; customDomainStatus: string };

/**
 * Starts payment of one member charge and returns where to send the payer: the gateway checkout, or the store's
 * bank-transfer page when the store has no gateway. The caller has already authorised the payer (they hold
 * their secret link or the public giving page) and confirmed the charge is DUE. The amount is always the charge's full amount.
 */
export async function startMemberCharge(input: {
  store: ChargeStore; chargeId: string; amount: number; payerName: string; payerEmail?: string | null;
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const { store, chargeId, amount } = input;
  if (!Number.isFinite(amount) || amount < MEMBER_MIN_ONLINE_PAYMENT) return { success: false, error: `Online payment starts at ${MEMBER_MIN_ONLINE_PAYMENT}. Please pay the office directly.` };

  // A handful of unpaid attempts is normal (abandoned checkouts); beyond that something is wrong.
  const open = await prisma.payment.count({ where: { memberChargeId: chargeId, purpose: "MEMBER_PAYMENT", status: "PENDING", provider: { not: "CASH" } } });
  if (open >= 5) return { success: false, error: "Too many unfinished payment attempts. Please contact the office." };

  const route = await resolvePayRoute(store.id);
  if (route.mode === "error") return { success: false, error: route.error };
  if (route.mode === "manual") {
    const { payUrl } = await startManualTransfer({ store, purpose: "MEMBER_PAYMENT", entityId: chargeId, amount, currency: "NGN", memberChargeId: chargeId });
    return { success: true, url: payUrl };
  }

  const checkout = await resolveCheckoutGateway(store.id);
  if (!checkout.ok) return { success: false, error: checkout.error };

  const reference = `${MEMBER_PAY_PREFIX}-${chargeId}-${shortToken()}`;
  await createPendingPayment({ storeId: store.id, memberChargeId: chargeId, purpose: "MEMBER_PAYMENT", provider: checkout.gateway, reference, amount, currency: "NGN", usesStoreGateway: checkout.usesStoreGateway });

  const charge = await chargeCustomer({
    email: input.payerEmail?.trim() || "member@biznest.space", customerName: input.payerName, amountNaira: amount, currency: "NGN", reference,
    callbackUrl: paymentCallbackUrl(checkout.gateway), storeId: store.id,
  });
  if (!charge.success) { await markPaymentFailed(reference); return { success: false, error: charge.error }; }
  await prisma.payment.update({ where: { reference }, data: { provider: charge.gateway, splitSubaccountCode: charge.splitSubaccountCode, usesStoreGateway: charge.usesStoreGateway ?? false } });
  return { success: true, url: charge.authorizationUrl };
}
