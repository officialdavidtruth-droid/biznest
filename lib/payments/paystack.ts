import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

type InitializeParams = {
  email: string;
  amountKobo: number; // Paystack works in the smallest currency unit
  reference: string;
  callbackUrl: string;
  subaccountCode?: string | null;
  /**
   * Who eats Paystack's transaction fee when this charge is split to a
   * subaccount. "account" = platform's main balance (we absorb it — what
   * happens by default if this is omitted); "subaccount" = the merchant's
   * share is debited for it. Confirmed with Paystack support (Aug 2026)
   * that this must be passed explicitly via `bearer_subaccount` or the
   * fee-bearer falls back to whatever the dashboard default is, which
   * isn't something we want to leave implicit for a marketplace split.
   */
  feeBearer?: "account" | "subaccount";
};

type InitializeResponse = {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
};

type VerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    customer?: { customer_code: string };
    authorization?: { authorization_code: string; reusable: boolean };
  };
};

export async function initializePaystackTransaction(params: InitializeParams): Promise<InitializeResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { status: false, message: "Payments aren't configured yet (missing PAYSTACK_SECRET_KEY)." };
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      ...(params.subaccountCode
        ? {
            subaccount: params.subaccountCode,
            // Paystack's docs use "bearer" (string "account" | "subaccount"),
            // not "bearer_subaccount" as support's email said -- verified
            // against https://paystack.com/docs/api/transaction/. Defaults
            // to "account" (platform absorbs the fee) if omitted.
            bearer: params.feeBearer ?? "account",
          }
        : {}),
    }),
  });

  return res.json();
}

export async function verifyPaystackTransaction(reference: string): Promise<VerifyResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { status: false, message: "Payments aren't configured yet (missing PAYSTACK_SECRET_KEY)." };
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  return res.json();
}

type RefundResponse = {
  status: boolean;
  message: string;
  data?: { id: number; status: string; amount: number; transaction_reference?: string };
};

/**
 * Issues a refund against a previously successful charge. Paystack refunds
 * by transaction reference (the same value we stored as Payment.reference),
 * not a separate refund-specific id. Omitting `amountKobo` refunds the full
 * amount; Paystack settles the refund back to the original payment method
 * on their own schedule (typically a few business days).
 *
 * https://paystack.com/docs/api/refund/
 */
export async function refundPaystackTransaction(
  reference: string,
  amountKobo?: number
): Promise<RefundResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { status: false, message: "Payments aren't configured yet (missing PAYSTACK_SECRET_KEY)." };
  }

  const res = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction: reference,
      ...(amountKobo ? { amount: amountKobo } : {}),
    }),
  });

  return res.json();
}

/**
 * Confirms a Paystack webhook request actually came from Paystack. Paystack
 * signs every webhook body with HMAC-SHA512 using your secret key and sends
 * the result in the `x-paystack-signature` header — recomputing it locally
 * and comparing is the only way to trust a webhook payload, since anyone
 * can POST to a public URL claiming to be Paystack otherwise.
 */
export function verifyPaystackWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signature) return false;
  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  // Constant-time comparison so signature checking itself can't leak timing
  // information about the expected value.
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Confirms an account number actually belongs to the named bank before we
 * save anything — same reasoning as the Flutterwave equivalent.
 */
export async function resolvePaystackAccount(accountNumber: string, bankCode: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { status: false as const, message: "Paystack isn't configured on this platform yet." };

  const res = await fetch(`${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.json() as Promise<{ status: boolean; message: string; data?: { account_name: string } }>;
}

export async function createPaystackSubaccount(params: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  commissionPercentage: number; // what the platform keeps, e.g. 8 for 8%
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  description?: string;
}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { status: false as const, message: "Paystack isn't configured on this platform yet." };

  const res = await fetch(`${PAYSTACK_BASE}/subaccount`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: params.businessName,
      bank_code: params.bankCode,
      account_number: params.accountNumber,
      percentage_charge: params.commissionPercentage,
      ...(params.primaryContactName ? { primary_contact_name: params.primaryContactName } : {}),
      ...(params.primaryContactEmail ? { primary_contact_email: params.primaryContactEmail } : {}),
      ...(params.primaryContactPhone ? { primary_contact_phone: params.primaryContactPhone } : {}),
      ...(params.description ? { description: params.description } : {}),
    }),
  });
  return res.json() as Promise<{
    status: boolean;
    message: string;
    data?: { subaccount_code: string; is_verified?: boolean; active?: boolean };
  }>;
}

/**
 * Checks whether Paystack has actually verified a subaccount's KYC, since
 * this can't be done at creation time -- Paystack confirmed (support, Aug
 * 2026) that subaccount verification is a manual dashboard review, not
 * something the API can trigger or predict. Call this on demand (e.g. a
 * "Refresh status" button on the payouts page) or from a periodic job to
 * catch verification as it completes, and only then stamp
 * Store.payoutVerifiedAt -- see refreshPayoutVerification in
 * lib/actions/store.ts. Until is_verified is true, Paystack still holds
 * the subaccount's first payout even though checkout itself works fine.
 */
export async function checkPaystackSubaccountVerification(
  subaccountCode: string
): Promise<{ status: boolean; message: string; isVerified?: boolean }> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { status: false, message: "Paystack isn't configured on this platform yet." };

  const res = await fetch(`${PAYSTACK_BASE}/subaccount/${encodeURIComponent(subaccountCode)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = (await res.json()) as { status: boolean; message: string; data?: { is_verified?: boolean } };
  return { status: json.status, message: json.message, isVerified: json.data?.is_verified };
}

type ChargeAuthResponse = {
  status: boolean;
  message: string;
  data?: { status: "success" | "failed"; reference: string; amount: number };
};

/**
 * Charges a card Paystack already has on file (from a prior successful
 * transaction that returned a reusable `authorization_code`), with no
 * further customer interaction. This is what makes subscription *renewal*
 * possible without the owner re-entering their card every month — see
 * app/api/cron/subscription-renewals, which calls this for every store due
 * to renew.
 */
export async function chargePaystackAuthorization(params: {
  email: string;
  amountKobo: number;
  authorizationCode: string;
  reference: string;
}): Promise<ChargeAuthResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { status: false, message: "Payments aren't configured yet (missing PAYSTACK_SECRET_KEY)." };

  const res = await fetch(`${PAYSTACK_BASE}/transaction/charge_authorization`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      authorization_code: params.authorizationCode,
      reference: params.reference,
    }),
  });
  return res.json();
}
