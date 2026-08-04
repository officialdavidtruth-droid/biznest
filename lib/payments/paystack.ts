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
