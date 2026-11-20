import "server-only";

/**
 * Dedicated bank account numbers per store, issued by whichever gateway SupaAdmin has switched on.
 * One function per gateway behind a single `openVirtualAccount()`.
 *
 * The BVN / NIN is passed straight to the gateway and is never stored or logged by BizNest.
 * Every provider call here is written from the provider's public docs: confirm each one in the
 * gateway's test mode before relying on it live.
 */

export type VirtualAccountGateway = "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";

export type OpenVirtualAccountInput = {
  gateway: VirtualAccountGateway;
  /** Our unique reference for this account (also how a webhook finds the store again). */
  reference: string;
  /** Name shown on the account. Keep it the business name; the bank may still show the gateway's format. */
  accountName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  /** Exactly one of these is required by the gateway. */
  bvn?: string | null;
  nin?: string | null;
};

export type OpenVirtualAccountResult =
  | { success: true; accountNumber: string; bankName: string; accountName: string }
  | { success: true; pending: true }
  | { success: false; error: string };

const FLW_BASE = "https://api.flutterwave.com/v3";
const KORA_BASE = (process.env.KORAPAY_BASE_URL || "https://api.korapay.com/merchant/api/v1").replace(/\/$/, "");
const PAYSTACK_BASE = "https://api.paystack.co";

async function json<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

export function isVirtualAccountIdentityValid(value: string): boolean {
  return /^\d{11}$/.test(value.trim());
}

export async function openVirtualAccount(input: OpenVirtualAccountInput): Promise<OpenVirtualAccountResult> {
  if (!input.bvn && !input.nin) return { success: false, error: "A BVN or NIN is required." };
  try {
    if (input.gateway === "FLUTTERWAVE") return await openFlutterwave(input);
    if (input.gateway === "KORAPAY") return await openKorapay(input);
    return await openPaystack(input);
  } catch {
    return { success: false, error: "Couldn't reach the payment provider. Please try again in a moment." };
  }
}

async function openFlutterwave(i: OpenVirtualAccountInput): Promise<OpenVirtualAccountResult> {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) return { success: false, error: "Flutterwave isn't configured yet (missing FLUTTERWAVE_SECRET_KEY)." };
  const res = await fetch(`${FLW_BASE}/virtual-account-numbers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: i.email,
      is_permanent: true,
      tx_ref: i.reference,
      firstname: i.firstName,
      lastname: i.lastName,
      narration: i.accountName.slice(0, 40),
      ...(i.phone ? { phonenumber: i.phone } : {}),
      ...(i.bvn ? { bvn: i.bvn } : { nin: i.nin }),
    }),
    cache: "no-store",
  });
  const body = await json<{ status?: string; message?: string; data?: { account_number?: string; bank_name?: string; note?: string } }>(res);
  if (body.status !== "success" || !body.data?.account_number) {
    return { success: false, error: body.message || "Flutterwave couldn't open the account." };
  }
  return { success: true, accountNumber: body.data.account_number, bankName: body.data.bank_name || "Flutterwave bank", accountName: i.accountName };
}

async function openKorapay(i: OpenVirtualAccountInput): Promise<OpenVirtualAccountResult> {
  const key = process.env.KORAPAY_SECRET_KEY;
  if (!key) return { success: false, error: "Korapay isn't configured yet (missing KORAPAY_SECRET_KEY)." };
  const res = await fetch(`${KORA_BASE}/virtual-bank-account`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      account_name: i.accountName.slice(0, 60),
      account_reference: i.reference,
      permanent: true,
      bank_code: "035", // Wema: the only bank Kora issues NGN accounts from today
      customer: { name: `${i.firstName} ${i.lastName}`.trim(), email: i.email },
      kyc: { ...(i.bvn ? { bvn: i.bvn } : {}), ...(i.nin ? { nin: i.nin } : {}) },
    }),
    cache: "no-store",
  });
  const body = await json<{ status?: boolean; message?: string; data?: { account_number?: string; bank_name?: string; account_name?: string } }>(res);
  if (body.status !== true || !body.data?.account_number) {
    return { success: false, error: body.message || "Korapay couldn't open the account." };
  }
  return { success: true, accountNumber: body.data.account_number, bankName: body.data.bank_name || "Wema Bank", accountName: body.data.account_name || i.accountName };
}

async function openPaystack(i: OpenVirtualAccountInput): Promise<OpenVirtualAccountResult> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return { success: false, error: "Paystack isn't configured yet (missing PAYSTACK_SECRET_KEY)." };
  if (!i.bvn) return { success: false, error: "Paystack needs a BVN. Please enter your BVN instead of an NIN." };
  // Paystack opens dedicated accounts asynchronously: the number arrives on the dedicatedaccount.assign.success webhook.
  const res = await fetch(`${PAYSTACK_BASE}/dedicated_account/assign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: i.email,
      first_name: i.firstName,
      last_name: i.lastName,
      phone: i.phone || undefined,
      preferred_bank: "wema-bank",
      country: "NG",
      ...(i.bvn ? { bvn: i.bvn } : {}),
      metadata: { biznest_reference: i.reference },
    }),
    cache: "no-store",
  });
  const body = await json<{ status?: boolean; message?: string }>(res);
  if (body.status !== true) return { success: false, error: body.message || "Paystack couldn't open the account." };
  return { success: true, pending: true };
}
