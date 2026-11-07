import { getActiveGateway } from "@/lib/actions/site-settings";

export { getActiveGateway };
import { initializePaystackTransaction, refundPaystackTransaction } from "@/lib/payments/paystack";
import { initializeFlutterwaveTransaction, refundFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { initializeKorapayTransaction, refundKorapayTransaction } from "@/lib/payments/korapay";
import type { PaymentProvider } from "@prisma/client";
import { logError } from "@/lib/observability/log";
import { APP_URL } from "@/lib/constants/app-url";
import { resolveStoreGateway, type StoreGatewayCredentials } from "@/lib/payments/store-gateway";
import { grossUpForGatewayFee } from "@/lib/payments/customer-fee";

export { billingCallbackUrl } from "@/lib/payments/billing-gateway";

/**
 * Gateway for platform-owned in-app payments: plan purchases, app purchases, ads, wallet top-ups.
 * It follows the same SupaAdmin switch as store checkout, so one click moves everything.
 */
export async function getBillingGateway(): Promise<PaymentGatewayId> {
  return getActiveGateway();
}

/** Every gateway a platform charge can go through. SupaAdmin picks the active one. */
export type PaymentGatewayId = "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";

type ChargeParams = {
  email: string;
  amountNaira: number; // the amount in `currency` (major units); named for its NGN origin. Each adapter converts as needed
  /** ISO code. Defaults to NGN. Anything else is only allowed on a store's own gateway keys. */
  currency?: string;
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
  gateway?: PaymentGatewayId;
  /** Storefront checkout can use the provider's hosted inline modal instead of navigating away. */
  inline?: boolean;
  /**
   * The store the customer is paying. When that store has switched on its own
   * payment gateway keys, the charge goes through THEIR account (and overrides
   * `gateway`). Omit for platform-owned money: subscriptions, app purchases
   * and customer wallet funding must never pass this.
   */
  storeId?: string | null;
  /**
   * Add the gateway's transaction fee on top of `amountNaira`, so the vendor receives the full price.
   * Always on for a store's own checkout (when `storeId` is given); pass true for other customer-paid flows
   * such as wallet top-ups. BizNest's own charges (plans, apps, ads) leave it off.
   */
  coverGatewayFee?: boolean;
};

type ChargeResult =
  | {
      success: true;
      authorizationUrl: string;
      gateway: PaymentGatewayId;
      /** What the customer is actually charged (price + gateway fee). Equals the price when no fee is added. */
      chargedNaira: number;
      /** The gateway fee added on top of the price, 0 when none. */
      gatewayFeeNaira: number;
      /** True when the charge was made with the store's own gateway keys. Persist it on the Payment row. */
      usesStoreGateway?: boolean;
      /** Always null now: charges are not split. Kept so existing callers that
       *  persist it on the Payment row keep compiling. */
      splitSubaccountCode: string | null;
      inline?: {
        provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";
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
  const currency = (params.currency ?? "NGN").toUpperCase();
  // The platform's gateway accounts settle in NGN. Never charge another currency into them.
  if (currency !== "NGN" && !own) return { success: false, error: `Online payment in ${currency} needs the store's own Paystack or Flutterwave keys.` };

  // Customer pays the gateway's fee: charge price + fee so the vendor is paid the full price.
  // Only for naira (the fee schedules are naira) and only for customer-paid flows.
  const addFee = currency === "NGN" && (params.coverGatewayFee === true || Boolean(params.storeId));
  const fee = addFee ? grossUpForGatewayFee(gateway, params.amountNaira) : { totalNaira: params.amountNaira, feeNaira: 0 };
  const chargeNaira = fee.totalNaira;
  const feeFields = { chargedNaira: chargeNaira, gatewayFeeNaira: fee.feeNaira };

  if (gateway === "KORAPAY") {
    // In-page popup when the caller asked for it and a Kora public key is configured
    // (platform gateway only: stores can't bring their own Kora keys). The popup
    // finishes on the same /korapay/callback + webhook that the redirect uses.
    const koraPublicKey = process.env.NEXT_PUBLIC_KORAPAY_PUBLIC_KEY || process.env.KORAPAY_PUBLIC_KEY;
    if (params.inline && koraPublicKey && !own) {
      return {
        success: true,
        authorizationUrl: params.callbackUrl,
        gateway: "KORAPAY",
        usesStoreGateway,
        ...feeFields,
        splitSubaccountCode: null,
        inline: {
          provider: "KORAPAY",
          publicKey: koraPublicKey,
          email: params.email,
          amountNaira: chargeNaira,
          reference: params.reference,
        },
      };
    }
    const init = await initializeKorapayTransaction({
      email: params.email,
      amountNaira: chargeNaira,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      notificationUrl: `${APP_URL}/api/payments/korapay/webhook`,
      customerName: params.customerName,
    });
    if (!init.status || !init.data?.checkout_url) {
      void logError("PAYMENTS", "Korapay charge init failed", { reference: params.reference, message: init.message });
      return { success: false, error: init.message || "Couldn't start the Korapay payment." };
    }
    return {
      success: true,
      authorizationUrl: init.data.checkout_url,
      gateway: "KORAPAY",
      usesStoreGateway,
      ...feeFields,
      splitSubaccountCode: null,
    };
  }

  if (gateway === "FLUTTERWAVE") {
    const publicKey = own ? own.publicKey : process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || process.env.FLUTTERWAVE_PUBLIC_KEY;
    if (params.inline && publicKey) {
      return {
        success: true,
        authorizationUrl: params.callbackUrl,
        gateway: "FLUTTERWAVE",
        usesStoreGateway,
        ...feeFields,
        splitSubaccountCode: null,
        inline: {
          provider: "FLUTTERWAVE",
          publicKey,
          email: params.email,
          amountNaira: chargeNaira,
          reference: params.reference,
        },
      };
    }
    const init = await initializeFlutterwaveTransaction({
      email: params.email,
      amountNaira: chargeNaira,
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      customerName: params.customerName,
      secretKey: own?.secretKey,
      currency,
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
      ...feeFields,
      splitSubaccountCode: null,
    };
  }

  const init = await initializePaystackTransaction({
    email: params.email,
    amountKobo: Math.round(chargeNaira * 100),
    reference: params.reference,
    callbackUrl: params.callbackUrl,
    secretKey: own?.secretKey,
    currency,
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
    ...feeFields,
    splitSubaccountCode: null,
    ...(params.inline && publicKey
      ? {
          inline: {
            provider: "PAYSTACK" as const,
            publicKey,
            email: params.email,
            amountNaira: chargeNaira,
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
  if (params.provider === "KORAPAY") {
    // Kora refunds by OUR payment reference, so no gateway transaction id is needed.
    const res = await refundKorapayTransaction(params.gatewayTransactionRef, params.amountNaira, params.secretKey);
    if (!res.status || !res.data) {
      void logError("PAYMENTS", "Korapay refund failed", { ref: params.gatewayTransactionRef, message: res.message });
      return { success: false, error: res.message || "Korapay declined the refund." };
    }
    return { success: true, refundReference: String(res.data.refund_reference) };
  }

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
  | { ok: true; gateway: PaymentGatewayId; usesStoreGateway: boolean }
  | { ok: false; error: string };

/**
 * Which gateway a store's customer payment will go through, decided BEFORE the
 * Payment row and callback URL are built. Mirrors the choice chargeCustomer
 * makes when given the same `storeId`: the store's own gateway if it has one
 * switched on, otherwise the platform's active gateway.
 */
export async function resolveCheckoutGateway(storeId: string, platformGateway?: PaymentGatewayId): Promise<CheckoutGateway> {
  const resolved = await resolveStoreGateway(storeId);
  if (resolved.status === "error") return { ok: false, error: resolved.message };
  if (resolved.status === "ok") return { ok: true, gateway: resolved.credentials.provider, usesStoreGateway: true };
  return { ok: true, gateway: platformGateway ?? (await getActiveGateway()), usesStoreGateway: false };
}

/** The redirect target a gateway sends the customer back to after paying. */
export function paymentCallbackUrl(gateway: PaymentGatewayId): string {
  if (gateway === "KORAPAY") return `${APP_URL}/api/payments/korapay/callback`;
  return gateway === "FLUTTERWAVE" ? `${APP_URL}/api/payments/flutterwave/callback` : `${APP_URL}/api/payments/paystack/callback`;
}

/** Does the gateway picked in SupaAdmin have its secret key set, so BizNest can take card payments for stores? */
export async function platformGatewayReady(): Promise<boolean> {
  const gateway = await getActiveGateway();
  const key = gateway === "PAYSTACK" ? process.env.PAYSTACK_SECRET_KEY : gateway === "FLUTTERWAVE" ? process.env.FLUTTERWAVE_SECRET_KEY : process.env.KORAPAY_SECRET_KEY;
  return Boolean(key && key.trim());
}
