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
      split_type: "percentage",
      split_value: params.splitPercentage / 100,
    }),
  });
  return res.json() as Promise<{ status: "success" | "error"; message: string; data?: { id: number; subaccount_id: string } }>;
}
