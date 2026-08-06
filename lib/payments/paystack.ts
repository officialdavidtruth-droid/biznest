const PAYSTACK_BASE = "https://api.paystack.co";

type InitializeParams = {
  email: string;
  amountKobo: number; // Paystack works in the smallest currency unit
  reference: string;
  callbackUrl: string;
  subaccountCode?: string | null;
};

type InitializeResponse = {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
};

type VerifyResponse = {
  status: boolean;
  message: string;
  data?: { status: "success" | "failed" | "abandoned"; reference: string; amount: number };
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
      ...(params.subaccountCode ? { subaccount: params.subaccountCode } : {}),
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
    }),
  });
  return res.json() as Promise<{ status: boolean; message: string; data?: { subaccount_code: string } }>;
}
