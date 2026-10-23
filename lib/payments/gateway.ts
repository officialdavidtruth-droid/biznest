import { getActiveGateway } from "@/lib/actions/site-settings";

export { getActiveGateway };
import { initializePaystackTransaction, refundPaystackTransaction } from "@/lib/payments/paystack";
import { initializeFlutterwaveTransaction, refundFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import type { PaymentProvider } from "@prisma/client";
import { logError } from "@/lib/observability/log";
import { APP_URL } from "@/lib/constants/app-url";
import { resolveStoreGateway, type StoreGatewayCredentials } from "@/lib/payments/store-gateway";

type ChargeParams = {
  email: string;
  amountNaira: number; // always pass the real-world Naira amount; each adapter converts as needed
  reference: string;
  callbackUrl: string;
  customerName?: string;
  /**
   * @deprecated Charges are never split any more: the customer pays the
   * platform's gateway account and the vendor is paid by the Transfer API
   * (lib/payments/payout.ts). These are ignored; call sites may drop them.
   */
  paystackSubaccountCode?: string | null;
  /** @deprecated See paystackSubaccountCode. Ignored. */
  flutterwaveSubaccountId?: string | null;
  /** @deprecated Only meaningful for split charges. Ignored. */
  feeBearer?: "account" | "subaccount";
  /**
   * Force a specific gateway instead of consulting the platform's "active
   * gateway" toggle. Platform-billing flows (subscription upgrades) pass
   * this explicitly — that money always goes to Paystack regardless of
   * which gateway supaadmin has switched on for store checkout — so the
   * two purposes can never accidentally follow the same switch again.
   * Store-checkout flows (orders/invoices/quotes) omit this and keep
   * following the toggle as before.
   */
  gateway?: "PAYSTACK" | "FLUTTERWAVE";
  /** Storefront checkout can use the provider's hosted inline modal instead of navigating away. */
  inline?: boolean;
  /**
   * The store the customer is paying. When that store has switched on its own
   * payment gateway keys, the charge goes through THEIR account (and overrides
   * `gateway`). Omit for platform-owned money: subscriptions, app purchases
   * and customer wallet funding must never pass this.
   */
  storeId?: string | null;
};

type ChargeResult =
  | {
      success: true;
      authorizationUrl: string;
      gateway: "PAYSTACK" | "FLUTTERWAVE";
      /** True when the charge was made with the store's own gateway keys. Persist it on the Payment row. */
      usesStoreGateway?: boolean;
      /** Always null now: charges are not split. Kept so existing callers that
       *  persist it on the Payment row keep compiling. */
      splitSubaccountCode: string | null;
      inline?: {
        provider: "PAYSTACK" | "FLUTTERWAVE";
        publicKey: string;
        email: string;
        accessCode?: string;
        /** The amount (NGN) the server created this payment for. Inline clients must charge THIS, never a client-side recomputation. */
        amountNaira: number;
        reference: string;
        subaccountCode?: string | null;
        subaccountId?: string | null;
      };
    }
  | { success: false; error: string };

/**
 * Single entry point every checkout/upgrade flow should call instead of
 * importing a specific gateway directly. By default, whichever provider
 * supaadmin has marked active is the one that actually gets used — flip
 * the switch there and every store "Pay now" button follows without a
 * code change. Pass `gateway` to override this for flows that must always
 * use one specific provider (see ChargeParams.gateway).
 */
export async function chargeCustomer(params: ChargeParams): Promise<ChargeResult> {
  let own: StoreGatewayCredentials | null = null;
  if (params.storeId) {
    const resolved = await resolveStoreGateway(params.storeId);
    if (resolved.status === "error") return { success: false, error: resolved.message };
    if (resolved.status === "ok") own = resolved.credentials;
  }
  const usesStoreGateway = Boolean(own);
  const gateway = own?.provider ?? params.gateway ?? (await getActiveGateway());

  if (gateway === "FLUTTERWAVE") {
    const publicKey = own ? own.publicKey : process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || process.env.FLUTTERWAVE_PUBLIC_KEY;
    if (params.inline && publicKey) {
      return {
        success: true,
        authorizationUrl: params.callbackUrl,
        gateway: "FLUTTERWAVE",
        usesStoreGateway,
        splitSubaccountCode: null,
        inline: {
          provider: "FLUTTERWAVE",
          publicKey,
          email: params.email,
          amountNaira: params.amountNaira,
          reference: params.reference,
        },
      };
    }
    const init = await initializeFlutterwaveTransaction({
      email: params.email,
      amountNaira: params.amountNaira,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      customerName: params.customerName,
      secretKey: own?.secretKey,
    });
    if (init.status !== "success" || !init.data) {
      void logError("PAYMENTS", "Flutterwave charge init failed", { reference: params.reference, message: init.message });
      return { success: false, error: init.message || "Couldn't start the Flutterwave payment." };
    }
    return {
      success: true,
      authorizationUrl: init.data.link,
      gateway: "FLUTTERWAVE",
      usesStoreGateway,
      splitSubaccountCode: null,
    };
  }

  const init = await initializePaystackTransaction({
    email: params.email,
    amountKobo: Math.round(params.amountNaira * 100),
    reference: params.reference,
    callbackUrl: params.callbackUrl,
    secretKey: own?.secretKey,
  });
  if (!init.status || !init.data) {
    void logError("PAYMENTS", "Paystack charge init failed", { reference: params.reference, message: init.message });
    return { success: false, error: init.message || "Couldn't start the Paystack payment." };
  }
  const publicKey = own ? own.publicKey : process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY;
  return {
    success: true,
    authorizationUrl: init.data.authorization_url,
    gateway: "PAYSTACK",
    usesStoreGateway,
    splitSubaccountCode: null,
    ...(params.inline && publicKey
      ? {
          inline: {
            provider: "PAYSTACK" as const,
            publicKey,
            email: params.email,
            amountNaira: params.amountNaira,
            accessCode: init.data.access_code,
            reference: init.data.reference || params.reference,
          },
        }
      : {}),
  };
}

type RefundParams = {
  provider: PaymentProvider;
  /** Payment.reference for Paystack; for Flutterwave this must be the
   *  gateway's own numeric transaction id (see refundPayment's caller —
   *  it's pulled from the stored verification rawPayload, since our
   *  tx_ref isn't what Flutterwave's refund endpoint accepts). */
  gatewayTransactionRef: string;
  amountNaira?: number;
  /** The store's own secret key for payments made with its own gateway (see secretKeyForPayment). */
  secretKey?: string;
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
    const res = await refundFlutterwaveTransaction(params.gatewayTransactionRef, params.amountNaira, params.secretKey);
    if (res.status !== "success" || !res.data) {
      void logError("PAYMENTS", "Flutterwave refund failed", { ref: params.gatewayTransactionRef, message: res.message });
      return { success: false, error: res.message || "Flutterwave declined the refund." };
    }
    return { success: true, refundReference: String(res.data.id) };
  }

  const amountKobo = params.amountNaira ? Math.round(params.amountNaira * 100) : undefined;
  const res = await refundPaystackTransaction(params.gatewayTransactionRef, amountKobo, params.secretKey);
  if (!res.status || !res.data) {
    void logError("PAYMENTS", "Paystack refund failed", { ref: params.gatewayTransactionRef, message: res.message });
    return { success: false, error: res.message || "Paystack declined the refund." };
  }
  return { success: true, refundReference: String(res.data.id) };
}


type CheckoutGateway =
  | { ok: true; gateway: "PAYSTACK" | "FLUTTERWAVE"; usesStoreGateway: boolean }
  | { ok: false; error: string };

/**
 * Which gateway a store's customer payment will go through, decided BEFORE the
 * Payment row and callback URL are built. Mirrors the choice chargeCustomer
 * makes when given the same `storeId`: the store's own gateway if it has one
 * switched on, otherwise the platform's active gateway.
 */
export async function resolveCheckoutGateway(storeId: string, platformGateway?: "PAYSTACK" | "FLUTTERWAVE"): Promise<CheckoutGateway> {
  const resolved = await resolveStoreGateway(storeId);
  if (resolved.status === "error") return { ok: false, error: resolved.message };
  if (resolved.status === "ok") return { ok: true, gateway: resolved.credentials.provider, usesStoreGateway: true };
  return { ok: true, gateway: platformGateway ?? (await getActiveGateway()), usesStoreGateway: false };
}

/** The redirect target a gateway sends the customer back to after paying. */
export function paymentCallbackUrl(gateway: "PAYSTACK" | "FLUTTERWAVE"): string {
  return gateway === "FLUTTERWAVE" ? `${APP_URL}/api/payments/flutterwave/callback` : `${APP_URL}/api/payments/paystack/callback`;
}
