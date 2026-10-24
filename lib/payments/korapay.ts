import crypto from "crypto";

/**
 * Korapay (Kora) adapter.
 *
 * Mirrors lib/payments/flutterwave.ts so gateway.ts / payout-gateway.ts can treat
 * the three providers the same way. Docs: https://developers.korapay.com
 *
 * - Test vs live is decided by the API keys, not the URL.
 *   Set KORAPAY_BASE_URL only if Kora tells you to use a different host.
 * - Amounts are in naira (major unit), like Flutterwave -- not kobo.
 * - Collections land in the platform's Kora balance; vendors are paid from it
 *   with the Payout (disburse) API, exactly like the Flutterwave flow.
 */

const KORA_BASE = (process.env.KORAPAY_BASE_URL || "https://api.korapay.com/merchant/api/v1").replace(/\/$/, "");
const NOT_CONFIGURED = "Payments aren't configured yet (missing KORAPAY_SECRET_KEY).";

function secret(override?: string | null): string | null {
  return override ?? process.env.KORAPAY_SECRET_KEY ?? null;
}

type KoraEnvelope<T> = { status: boolean; message: string; data?: T | null };

async function koraFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; secretKey?: string | null } = {}
): Promise<KoraEnvelope<T> & { httpStatus: number }> {
  const key = secret(init.secretKey);
  if (!key) return { status: false, message: NOT_CONFIGURED, httpStatus: 0 };
  const res = await fetch(`${KORA_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    cache: "no-store",
  });
  let json: Partial<KoraEnvelope<T>> = {};
  try {
    json = (await res.json()) as Partial<KoraEnvelope<T>>;
  } catch {
    /* non-JSON error body: fall through with the HTTP status */
  }
  return {
    status: json.status === true,
    message: json.message ?? (res.ok ? "" : `Korapay returned HTTP ${res.status}`),
    data: json.data ?? null,
    httpStatus: res.status,
  };
}

const to2dp = (n: number) => Math.round(n * 100) / 100;

/* -------------------------------------------------------------------------- */
/* Collections (checkout redirect)                                             */
/* -------------------------------------------------------------------------- */

export type KorapayInitializeResponse = {
  status: boolean;
  message: string;
  data?: { reference: string; checkout_url: string } | null;
};

export async function initializeKorapayTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  /** Where Kora POSTs charge.success. Defaults to the dashboard-configured webhook when omitted. */
  notificationUrl?: string;
  customerName?: string;
  narration?: string;
  secretKey?: string | null;
}): Promise<KorapayInitializeResponse> {
  const res = await koraFetch<{ reference: string; checkout_url: string }>("/charges/initialize", {
    method: "POST",
    secretKey: params.secretKey,
    body: {
      amount: to2dp(params.amountNaira),
      currency: "NGN",
      reference: params.reference,
      redirect_url: params.callbackUrl,
      ...(params.notificationUrl ? { notification_url: params.notificationUrl } : {}),
      narration: params.narration ?? "BizNest payment",
      // The customer pays exactly the order total; any gateway fee comes out of the platform's balance.
      merchant_bears_cost: true,
      customer: { name: params.customerName ?? params.email, email: params.email },
    },
  });
  return { status: res.status, message: res.message, data: res.data };
}

/**
 * Normalised so callers can reuse the Flutterwave settle logic: `status` is
 * "successful" | "failed" | "pending" and `tx_ref` is OUR reference.
 */
export type KorapayVerifyResponse = {
  status: "success" | "error";
  message: string;
  data?: {
    status: "successful" | "failed" | "pending";
    tx_ref: string;
    amount: number;
    currency: string;
    gatewayStatus: string;
    raw: unknown;
  };
};

export async function verifyKorapayTransaction(reference: string, secretKeyOverride?: string | null): Promise<KorapayVerifyResponse> {
  const res = await koraFetch<{
    reference?: string;
    status?: string;
    amount?: string | number;
    amount_paid?: string | number;
    currency?: string;
  }>(`/charges/${encodeURIComponent(reference)}`, { secretKey: secretKeyOverride });
  if (!res.status || !res.data) return { status: "error", message: res.message || "Couldn't verify the Korapay payment." };

  const d = res.data;
  const gatewayStatus = String(d.status ?? "").toLowerCase();
  const normalised = gatewayStatus === "success" ? "successful" : gatewayStatus === "failed" ? "failed" : "pending";
  // amount_paid is what actually reached Kora (bank transfers can under/over-pay); fall back to the charge amount.
  const paid = Number(d.amount_paid ?? d.amount ?? 0);
  return {
    status: "success",
    message: res.message,
    data: {
      status: normalised,
      tx_ref: String(d.reference ?? ""),
      amount: Number.isFinite(paid) ? paid : 0,
      currency: String(d.currency ?? "NGN"),
      gatewayStatus,
      raw: d,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                     */
/* -------------------------------------------------------------------------- */

/** Deterministic refund reference (max 50 chars): same payment + amount always maps to the same refund. */
export function korapayRefundReference(paymentReference: string, amountNaira?: number): string {
  return `bnr-${crypto.createHash("sha256").update(`${paymentReference}|${amountNaira ?? "full"}`).digest("hex").slice(0, 32)}`;
}

/** Reads a refund back by the reference we generated. `status` is processing | success | failed. */
export async function getKorapayRefund(refundReference: string, secretKeyOverride?: string | null) {
  const res = await koraFetch<{ reference: string; status: string; amount?: string }>(`/refunds/${encodeURIComponent(refundReference)}`, {
    secretKey: secretKeyOverride,
  });
  return { status: res.status, message: res.message, data: res.data, notFound: !res.status && (res.httpStatus === 404 || /not found/i.test(res.message)) };
}

export type KorapayRefundResponse = {
  status: boolean;
  message: string;
  data?: { refund_reference: string; status: string; amount_returned?: number } | null;
};

/**
 * Refunds by OUR payment reference (Kora's `payment_reference`). The refund
 * reference is derived deterministically, so repeating a request for the same
 * payment + amount can never create a second refund. NGN minimum is 100.
 */
export async function refundKorapayTransaction(
  paymentReference: string,
  amountNaira?: number,
  secretKeyOverride?: string | null,
  reason = "Refund issued by merchant"
): Promise<KorapayRefundResponse> {
  const refundRef = korapayRefundReference(paymentReference, amountNaira);
  const res = await koraFetch<{ refund_reference: string; status: string; amount_returned?: number }>("/refunds/initiate", {
    method: "POST",
    secretKey: secretKeyOverride,
    body: {
      payment_reference: paymentReference,
      reference: refundRef,
      reason: reason.slice(0, 200),
      ...(amountNaira ? { amount: to2dp(amountNaira) } : {}),
    },
  });
  return { status: res.status, message: res.message, data: res.data };
}

/* -------------------------------------------------------------------------- */
/* Webhooks                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Kora signs ONLY the `data` object of the payload: HMAC-SHA256 of
 * JSON.stringify(payload.data) using the secret key, sent in `x-korapay-signature`.
 */
export function verifyKorapayWebhookSignature(signature: string | null, data: unknown, secretKeyOverride?: string | null): boolean {
  const key = secret(secretKeyOverride);
  if (!key || !signature || data === undefined || data === null) return false;
  const expected = crypto.createHmac("sha256", key).update(JSON.stringify(data)).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* -------------------------------------------------------------------------- */
/* Bank utilities                                                              */
/* -------------------------------------------------------------------------- */

export async function resolveKorapayAccount(accountNumber: string, bankCode: string) {
  // Kora's resolve endpoint calls the country code "currency" (e.g. NG).
  const res = await koraFetch<{ account_name: string; bank_name?: string }>("/misc/banks/resolve", {
    method: "POST",
    body: { bank: bankCode, account: accountNumber, currency: "NG" },
  });
  return { status: res.status, message: res.message, data: res.data };
}

export async function listKorapayBanks(): Promise<{ status: boolean; message: string; banks: { name: string; code: string }[] }> {
  const res = await koraFetch<{ name: string; code: string }[]>("/misc/banks?countryCode=NG");
  const banks = Array.isArray(res.data) ? res.data.map((b) => ({ name: b.name, code: b.code })) : [];
  return { status: res.status, message: res.message, banks };
}

/* -------------------------------------------------------------------------- */
/* Payouts (vendor money)                                                      */
/* -------------------------------------------------------------------------- */

export type KorapayTransferData = { reference: string; status: string; amount?: string; fee?: string; message?: string };

/**
 * Sends money from the platform's Kora balance to a bank account. `reference`
 * is our idempotency key (derived from the payout row). `processing` is a
 * normal answer; the final outcome arrives via the transfer.success /
 * transfer.failed webhook or verifyKorapayTransfer.
 *
 * Live mode only accepts calls from server IPs whitelisted in the Kora dashboard.
 */
export async function initiateKorapayTransfer(params: {
  bankCode: string;
  accountNumber: string;
  amountNaira: number;
  reference: string;
  narration?: string;
  beneficiaryName?: string;
  customerEmail?: string;
  notificationUrl?: string;
}) {
  const res = await koraFetch<KorapayTransferData>("/transactions/disburse", {
    method: "POST",
    body: {
      reference: params.reference,
      destination: {
        type: "bank_account",
        amount: to2dp(params.amountNaira),
        currency: "NGN",
        narration: params.narration ?? "BizNest payout",
        bank_account: { bank: params.bankCode, account: params.accountNumber },
        customer: {
          ...(params.beneficiaryName ? { name: params.beneficiaryName } : {}),
          email: params.customerEmail ?? process.env.KORAPAY_PAYOUT_EMAIL ?? "payouts@biznest.space",
        },
      },
      ...(params.notificationUrl ? { notification_url: params.notificationUrl } : {}),
    },
  });
  return { status: res.status, message: res.message, data: res.data };
}

/** Looks a payout up by OUR reference. `notFound` is true only on a positive 404 / "not found". */
export async function verifyKorapayTransfer(reference: string) {
  const res = await koraFetch<KorapayTransferData>(`/transactions/${encodeURIComponent(reference)}`);
  const notFound = !res.status && (res.httpStatus === 404 || /not found|no transaction|does not exist/i.test(res.message));
  return { status: res.status, message: res.message, data: res.data, notFound };
}

/** Platform's available Kora NGN balance in naira, or undefined when it couldn't be read. */
export async function getKorapayBalanceNaira(): Promise<{ status: boolean; message: string; balanceNaira?: number }> {
  const res = await koraFetch<{ NGN?: { available_balance?: number | string } }>("/balances");
  const raw = res.data?.NGN?.available_balance;
  const n = raw === undefined ? NaN : Number(raw);
  return { status: res.status, message: res.message, balanceNaira: Number.isFinite(n) ? n : undefined };
}
