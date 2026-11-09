import crypto from "node:crypto";

/**
 * Unsubscribe tokens for BizNest's own emails (signup reminders and
 * promotional campaigns). Separate from the store-newsletter token in
 * unsubscribe-token.ts: the payload names a user, not a store, and carries a
 * "platform" marker so a token for one kind can never be replayed for the other.
 */
function getSecret() {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("NEWSLETTER_UNSUBSCRIBE_SECRET (or AUTH_SECRET) must be set to sign unsubscribe tokens.");
  return secret;
}

export function createPlatformUnsubscribeToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ k: "platform", u: userId })).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function decodePlatformUnsubscribeToken(token: string | null | undefined): { userId: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url"));
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.k !== "platform" || !data.u) return null;
    return { userId: String(data.u) };
  } catch {
    return null;
  }
}
