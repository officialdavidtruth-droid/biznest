import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Bring-your-own payment gateway.
 *
 * A store owner can save their own Paystack and/or Flutterwave keys. While
 * Store.ownGatewayEnabled is on, customer payments for that store are charged
 * with THOSE keys, so the money goes straight to the merchant's own gateway
 * account. Payments made this way are flagged Payment.usesStoreGateway, which
 * makes verification, webhooks and refunds use the store's keys, and stops
 * BizNest from creating a vendor payout for them (the platform never held
 * the money).
 *
 * Platform billing (subscriptions, app purchases) and customer wallet funding
 * never use store keys: those funds belong to / are held by BizNest.
 */

export type GatewayProvider = "PAYSTACK" | "FLUTTERWAVE";

export type StoreGatewayCredentials = {
  provider: GatewayProvider;
  secretKey: string;
  publicKey: string | null;
  /** Flutterwave only: the verif-hash the merchant configured on their dashboard. */
  secretHash: string | null;
};

/* -------------------------------------------------------------------------- */
/* Encryption at rest (AES-256-GCM)                                            */
/* -------------------------------------------------------------------------- */

function encryptionKey(): Buffer {
  const raw = process.env.STORE_GATEWAY_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error("Set STORE_GATEWAY_ENCRYPTION_KEY (or AUTH_SECRET) to store payment keys securely.");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

const credentialSelect = {
  ownGatewayEnabled: true,
  ownGatewayProvider: true,
  ownPaystackSecretKey: true,
  ownPaystackPublicKey: true,
  ownFlutterwaveSecretKey: true,
  ownFlutterwavePublicKey: true,
  ownFlutterwaveSecretHash: true,
} as const;

type StoredFields = {
  ownPaystackSecretKey: string | null;
  ownPaystackPublicKey: string | null;
  ownFlutterwaveSecretKey: string | null;
  ownFlutterwavePublicKey: string | null;
  ownFlutterwaveSecretHash: string | null;
};

function credentialsFrom(row: StoredFields, provider: GatewayProvider): StoreGatewayCredentials | null {
  try {
    if (provider === "PAYSTACK") {
      if (!row.ownPaystackSecretKey) return null;
      return { provider, secretKey: decryptSecret(row.ownPaystackSecretKey), publicKey: row.ownPaystackPublicKey, secretHash: null };
    }
    if (!row.ownFlutterwaveSecretKey) return null;
    return {
      provider,
      secretKey: decryptSecret(row.ownFlutterwaveSecretKey),
      publicKey: row.ownFlutterwavePublicKey,
      secretHash: row.ownFlutterwaveSecretHash ? decryptSecret(row.ownFlutterwaveSecretHash) : null,
    };
  } catch {
    return null;
  }
}

/**
 * The saved keys for one provider, whether or not the store currently has its
 * own gateway switched on. Needed to verify/refund OLD payments after the
 * owner has switched provider or paused the feature.
 */
export async function loadStoreCredentials(storeId: string, provider: GatewayProvider): Promise<StoreGatewayCredentials | null> {
  const row = await prisma.store.findUnique({ where: { id: storeId }, select: credentialSelect });
  if (!row) return null;
  return credentialsFrom(row, provider);
}

export type ResolvedStoreGateway =
  | { status: "none" }
  | { status: "ok"; credentials: StoreGatewayCredentials }
  | { status: "error"; message: string };

/**
 * Which gateway should NEW customer payments for this store use?
 *  - none:  the store isn't using its own keys -> use the platform flow.
 *  - ok:    charge with these credentials.
 *  - error: the owner turned it on but the keys can't be used. Never fall
 *           back silently: that would send the money to a different account
 *           than the owner expects.
 */
export async function resolveStoreGateway(storeId: string): Promise<ResolvedStoreGateway> {
  const row = await prisma.store.findUnique({ where: { id: storeId }, select: credentialSelect });
  if (!row || !row.ownGatewayEnabled || !row.ownGatewayProvider) return { status: "none" };
  if (row.ownGatewayProvider !== "PAYSTACK" && row.ownGatewayProvider !== "FLUTTERWAVE") return { status: "none" };
  const credentials = credentialsFrom(row, row.ownGatewayProvider);
  if (!credentials) {
    return {
      status: "error",
      message: "This store's payment keys need to be re-entered by the owner. Online checkout is temporarily unavailable.",
    };
  }
  return { status: "ok", credentials };
}

/**
 * Secret key to use for verifying/refunding an existing payment.
 *  - undefined: platform payment -> callers use the platform's env key.
 *  - ""       : store payment but its keys are gone -> callers' "missing key" error path.
 *  - string   : the store's own secret key.
 */
export async function secretKeyForPayment(payment: { usesStoreGateway?: boolean | null; storeId?: string | null; provider: string }): Promise<string | undefined> {
  if (!payment.usesStoreGateway) return undefined;
  if (!payment.storeId || (payment.provider !== "PAYSTACK" && payment.provider !== "FLUTTERWAVE")) return "";
  const creds = await loadStoreCredentials(payment.storeId, payment.provider);
  return creds?.secretKey ?? "";
}

/** Same as secretKeyForPayment, but looks the payment up by its gateway reference first. */
export async function secretKeyForReference(reference: string): Promise<string | undefined> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    select: { usesStoreGateway: true, storeId: true, provider: true },
  });
  if (!payment) return undefined;
  return secretKeyForPayment(payment);
}

/* -------------------------------------------------------------------------- */
/* Key format + live validation                                                */
/* -------------------------------------------------------------------------- */

export type KeyMode = "live" | "test";

export function paystackKeyMode(key: string): KeyMode | null {
  if (/^(sk|pk)_live_[A-Za-z0-9]+$/.test(key)) return "live";
  if (/^(sk|pk)_test_[A-Za-z0-9]+$/.test(key)) return "test";
  return null;
}

export function flutterwaveKeyMode(key: string): KeyMode | null {
  if (/^FLW(SECK|PUBK)_TEST[-_A-Za-z0-9]*$/.test(key)) return "test";
  if (/^FLW(SECK|PUBK)[-_A-Za-z0-9]+$/.test(key)) return "live";
  return null;
}

/** Asks Paystack to authenticate the secret key (a cheap read-only call). */
export async function checkPaystackSecretKey(secretKey: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=1", {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (res.status === 401) return { ok: false, message: "Paystack rejected this secret key. Check that you copied it correctly." };
    const json = (await res.json()) as { status?: boolean; message?: string };
    return json.status ? { ok: true } : { ok: false, message: json.message || "Paystack couldn't verify this key." };
  } catch {
    return { ok: false, message: "Couldn't reach Paystack to verify the key. Try again." };
  }
}

/** Asks Flutterwave to authenticate the secret key (a cheap read-only call). */
export async function checkFlutterwaveSecretKey(secretKey: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("https://api.flutterwave.com/v3/banks/NG", {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (res.status === 401) return { ok: false, message: "Flutterwave rejected this secret key. Check that you copied it correctly." };
    const json = (await res.json()) as { status?: string; message?: string };
    return json.status === "success" ? { ok: true } : { ok: false, message: json.message || "Flutterwave couldn't verify this key." };
  } catch {
    return { ok: false, message: "Couldn't reach Flutterwave to verify the key. Try again." };
  }
}

export function generateWebhookSecretHash(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** "sk_live_abcd…wxyz" style preview that is safe to show in the dashboard. */
export function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}••••${key.slice(-4)}`;
}
