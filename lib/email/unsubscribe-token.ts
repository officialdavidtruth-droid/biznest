import crypto from "node:crypto";

/**
 * No hardcoded fallback here on purpose: a guessable default secret would
 * make unsubscribe tokens forgeable (anyone could unsubscribe any address
 * from any store). Fail loudly at startup instead of silently signing
 * tokens with a well-known string.
 */
function getSecret() {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("NEWSLETTER_UNSUBSCRIBE_SECRET (or AUTH_SECRET) must be set to sign unsubscribe tokens.");
  return secret;
}

export function createUnsubscribeToken(storeId: string, email: string) {
  const secret = getSecret();
  const payload = Buffer.from(JSON.stringify({ storeId, email })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function decodeUnsubscribeToken(token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const secret = getSecret();
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(crypto.createHmac("sha256", secret).update(payload).digest("base64url"));
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.storeId || !data.email) return null;
    return { storeId: String(data.storeId), email: String(data.email).toLowerCase() };
  } catch {
    return null;
  }
}
