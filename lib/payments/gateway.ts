import { getActiveGateway } from "@/lib/actions/site-settings";

export { getActiveGateway };
import { initializePaystackTransaction, refundPaystackTransaction } from "@/lib/payments/paystack";
import { initializeFlutterwaveTransaction, refundFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import type { PaymentProvider } from "@prisma/client";
import { logError } from "@/lib/observability/log";

type ChargeParams = {
  email: string;
  amountNaira: number; // always pass the real-world Naira amount; each adapter converts as needed
  reference: string;
  callbackUrl: string;
  customerName?: string;
  /** Vendor payout split target — pass the field matching whichever gateway ends up active. */
  paystackSubaccountCode?: string | null;
  flutterwaveSubaccountId?: string | null;
};

type ChargeResult = { success: true; authorizationUrl: string; gateway: "PAYSTACK" | "FLUTTERWAVE" } | { success: false; error: string };

/**
 * Single entry point every checkout/upgrade flow should call instead of
 * importing a specific gateway directly. Whichever provider supaadmin has
 * marked active is the one that actually gets used — flip the switch there
 * and every "Pay now" button on the platform follows without a code change.
 */
export async function chargeCustomer(params: ChargeParams): Promise<ChargeResult> {
  const gateway = await getActiveGateway();

  if (gateway === "FLUTTERWAVE") {
    const init = await initializeFlutterwaveTransaction({
      email: params.email,
      amountNaira: params.amountNaira,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      customerName: params.customerName,
      subaccountId: params.flutterwaveSubaccountId,
    });
    if (init.status !== "success" || !init.data) {
      void logError("PAYMENTS", "Flutterwave charge init failed", { reference: params.reference, message: init.message });
      return { success: false, error: init.message || "Couldn't start the Flutterwave payment." };
    }
    return { success: true, authorizationUrl: init.data.link, gateway: "FLUTTERWAVE" };
  }

  const init = await initializePaystackTransaction({
    email: params.email,
    amountKobo: Math.round(params.amountNaira * 100),
    reference: params.reference,
    callbackUrl: params.callbackUrl,
    subaccountCode: params.paystackSubaccountCode,
  });
  if (!init.status || !init.data) {
    void logError("PAYMENTS", "Paystack charge init failed", { reference: params.reference, message: init.message });
    return { success: false, error: init.message || "Couldn't start the Paystack payment." };
  }
  return { success: true, authorizationUrl: init.data.authorization_url, gateway: "PAYSTACK" };
}

type RefundParams = {
  provider: PaymentProvider;
  /** Payment.reference for Paystack; for Flutterwave this must be the
   *  gateway's own numeric transaction id (see refundPayment's caller —
   *  it's pulled from the stored verification rawPayload, since our
   *  tx_ref isn't what Flutterwave's refund endpoint accepts). */
  gatewayTransactionRef: string;
  amountNaira?: number;
};

type RefundResult = { success: true; refundReference: string } | { success: false; error: string };

/**
 * Single entry point for issuing a refund, mirroring chargeCustomer above.
 * Unlike chargeCustomer this doesn't consult the platform's "active
 * gateway" setting — a refund must go back through whichever provider
 * actually processed the original charge, not whichever one is currently
 * switched on.
 */
export async function refundPayment(params: RefundParams): Promise<RefundResult> {
  if (params.provider === "FLUTTERWAVE") {
    const res = await refundFlutterwaveTransaction(params.gatewayTransactionRef, params.amountNaira);
    if (res.status !== "success" || !res.data) {
      void logError("PAYMENTS", "Flutterwave refund failed", { ref: params.gatewayTransactionRef, message: res.message });
      return { success: false, error: res.message || "Flutterwave declined the refund." };
    }
    return { success: true, refundReference: String(res.data.id) };
  }

  const amountKobo = params.amountNaira ? Math.round(params.amountNaira * 100) : undefined;
  const res = await refundPaystackTransaction(params.gatewayTransactionRef, amountKobo);
  if (!res.status || !res.data) {
    void logError("PAYMENTS", "Paystack refund failed", { ref: params.gatewayTransactionRef, message: res.message });
    return { success: false, error: res.message || "Paystack declined the refund." };
  }
  return { success: true, refundReference: String(res.data.id) };
}
