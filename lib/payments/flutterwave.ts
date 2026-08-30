import crypto from "crypto";

const FLW_BASE = "https://api.flutterwave.com/v3";

type InitializeParams = {
  email: string;
  amountNaira: number; // Flutterwave works in the major currency unit, unlike Paystack's kobo
  reference: string;
  callbackUrl: string;
  subaccountId?: string | null;
  customerName?: string;
};

type InitializeResponse = {
  status: "success" | "error";
  message: string;
  data?: { link: string };
};

type VerifyResponse = {
  status: "success" | "error";
  message: string;
  data?: { status: "successful" | "failed" | "pending"; tx_ref: string; amount: number };
};

export async function initializeFlutterwaveTransaction(params: InitializeParams): Promise<InitializeResponse> {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    return { status: "error", message: "Payments aren't configured yet (missing FLUTTERWAVE_SECRET_KEY)." };
  }

  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: params.reference,
      amount: params.amountNaira,
      currency: "NGN",
      redirect_url: params.callbackUrl,
      customer: { email: params.email, name: params.customerName ?? params.email },
      ...(params.subaccountId ? { subaccounts: [{ id: params.subaccountId }] } : {}),
    }),
  });

  return res.json();
}

/**
 * Flutterwave's verify endpoint takes their internal transaction id, not the
 * tx_ref we generated — the caller gets that id back from the redirect query
 * string (`transaction_id`) after the customer completes payment.
 */
export async function verifyFlutterwaveTransaction(transactionId: string): Promise<VerifyResponse> {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    return { status: "error", message: "Payments aren't configured yet (missing FLUTTERWAVE_SECRET_KEY)." };
  }

  const res = await fetch(`${FLW_BASE}/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  return res.json();
}

type RefundResponse = {
  status: "success" | "error";
  message: string;
  data?: { id: number; amount_refunded: number; status: string };
};

/**
 * Issues a refund against a previously successful charge. Unlike Paystack,
 * Flutterwave refunds by their internal numeric transaction id (the same
 * id `verifyFlutterwaveTransaction` takes) rather than our tx_ref.
 * Omitting `amountNaira` refunds the full amount.
 *
 * https://developer.flutterwave.com/reference/endpoints/refunds
 */
export async function refundFlutterwaveTransaction(
  transactionId: string,
  amountNaira?: number
): Promise<RefundResponse> {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) {
    return { status: "error", message: "Payments aren't configured yet (missing FLUTTERWAVE_SECRET_KEY)." };
  }

  const res = await fetch(`${FLW_BASE}/transactions/${encodeURIComponent(transactionId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(amountNaira ? { amount: amountNaira } : {}),
  });

  return res.json();
}

/**
 * Confirms a Flutterwave webhook request actually came from Flutterwave.
 * Unlike Paystack, Flutterwave doesn't HMAC-sign the body — you configure a
 * static secret hash in the dashboard, and every webhook echoes it back in
 * the `verif-hash` header. A plain equality check against that configured
 * value is what Flutterwave's own docs specify.
 */
export function verifyFlutterwaveWebhookSignature(signature: string | null): boolean {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secretHash || !signature) return false;
  const a = Buffer.from(secretHash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Store owners connect payout by giving us their bank + account number; we
 * resolve it against Flutterwave to confirm the account name before saving
 * anything, so a typo'd account number can't silently eat someone's payouts.
 */
export async function resolveFlutterwaveAccount(accountNumber: string, bankCode: string) {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) return { status: "error" as const, message: "Flutterwave isn't configured on this platform yet." };

  const res = await fetch(`${FLW_BASE}/accounts/resolve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
  });
  return res.json() as Promise<{ status: "success" | "error"; message: string; data?: { account_name: string } }>;
}

export async function createFlutterwaveSubaccount(params: {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessContact: string;
  businessContactPhone?: string;
  bankCode: string;
  accountNumber: string;
  splitPercentage: number; // what the platform keeps, e.g. 8 for 8%
}) {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) return { status: "error" as const, message: "Flutterwave isn't configured on this platform yet." };

  const res = await fetch(`${FLW_BASE}/subaccounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account_bank: params.bankCode,
      account_number: params.accountNumber,
      business_name: params.businessName,
      business_email: params.businessEmail,
      business_mobile: params.businessPhone,
      business_email: params.businessEmail,
      business_contact: params.businessContact,
      business_contact_mobile: params.businessContactPhone ?? params.businessPhone,
      country: "NG",
      split_type: "percentage",
      split_value: params.splitPercentage / 100,
    }),
  });
  return res.json() as Promise<{ status: "success" | "error"; message: string; data?: { id: number; subaccount_id: string } }>;
}
