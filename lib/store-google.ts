import { createHmac, timingSafeEqual } from "crypto";

/**
 * Google sign-in for STOREFRONT customers. Separate from the platform's Auth.js Google login: it signs a customer
 * in to exactly one store (bn-store-customer cookie), never into the BizNest app.
 *
 * Flow: store host /start -> Google -> www.biznest.space /callback (the only URL registered with Google)
 *       -> back to the store host /finish, which sets the cookie on the host the shopper is actually using
 *       (a vendor's own domain can't read a cookie set on biznest.space).
 */
export const PLATFORM_ORIGIN = "https://www.biznest.space";
export const GOOGLE_CALLBACK_URL = `${PLATFORM_ORIGIN}/api/store-google/callback`;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not configured.");
  return s;
}

/** Signed, short-lived, URL-safe token. `kind` stops one token type being used as another. */
export function signToken(kind: string, payload: Record<string, unknown>, ttlMs: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, k: kind, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(`${kind}.${body}`).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(kind: string, token: string | null | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(`${kind}.${body}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { k: string; exp: number };
    if (data.k !== kind || typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/** Origins a store may legitimately be served from: the platform host, or its own verified custom domain. */
export function allowedStoreOrigins(store: { customDomain: string | null; customDomainStatus: string }): string[] {
  const origins = [PLATFORM_ORIGIN];
  if (store.customDomain && store.customDomainStatus === "VERIFIED") origins.push(`https://${store.customDomain}`);
  return origins;
}
