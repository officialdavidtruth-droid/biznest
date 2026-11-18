import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sign-in-free order tracking. The link carries an HMAC of the order id, so it opens exactly that order and
 * nothing else, from any device. It is derived (not stored), so nothing needs a migration, and it can't be
 * guessed without AUTH_SECRET. The page it opens shows status and items only: no address, wallet or account.
 */
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not configured.");
  return s;
}

export function orderTrackingToken(orderId: string): string {
  return createHmac("sha256", secret()).update(`order-tracking:${orderId}`).digest("base64url").slice(0, 32);
}

export function verifyOrderTrackingToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(orderTrackingToken(orderId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Absolute link for emails and messages (path-based store URL, like the rest of the platform). */
export function orderTrackingUrl(appUrl: string, storeSlug: string, orderId: string): string {
  return `${appUrl.replace(/\/$/, "")}/${storeSlug}/order-status/${orderId}?t=${orderTrackingToken(orderId)}`;
}
