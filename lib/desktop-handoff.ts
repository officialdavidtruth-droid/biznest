import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Sign-in handoff for the BizNest desktop app.
 *
 * Google refuses to sign anyone in from inside an embedded app window, so the desktop app sends the person
 * to their normal browser. Once Google has signed them in there, the site mints a short-lived code and
 * returns it to the app (biznest://auth?code=...). The app trades the code for a session in its own window.
 *
 * The code is stateless: an HMAC (keyed with AUTH_SECRET) over {user, challenge, expiry}. It is bound to a
 * PKCE-style challenge: the app invents a random verifier, gives the browser only sha256(verifier), and
 * must present the verifier when redeeming. A code that leaks (browser history, another app registered
 * for biznest://) is useless without the verifier, which never leaves the app until redemption.
 */
const TTL_MS = 2 * 60 * 1000;
const b64u = (b: Buffer) => b.toString("base64url");

function key(): string {
  const k = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!k) throw new Error("AUTH_SECRET is not set");
  return `desktop-handoff:${k}`;
}

export const isChallenge = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);
export const challengeFor = (verifier: string) => b64u(createHash("sha256").update(verifier).digest());

export function signHandoff(userId: string, challenge: string, now = Date.now()): string {
  const body = b64u(Buffer.from(JSON.stringify({ u: userId, c: challenge, e: now + TTL_MS })));
  const sig = b64u(createHmac("sha256", key()).update(body).digest());
  return `${body}.${sig}`;
}

/** Returns the user id when the code is genuine, unexpired and the verifier matches its challenge. */
export function verifyHandoff(code: string, verifier: string, now = Date.now()): string | null {
  if (typeof code !== "string" || typeof verifier !== "string" || verifier.length < 32 || verifier.length > 200) return null;
  const [body, sig] = code.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key()).update(body).digest();
  let given: Buffer;
  try { given = Buffer.from(sig, "base64url"); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u?: string; c?: string; e?: number };
    if (!p.u || !p.c || typeof p.e !== "number" || p.e < now) return null;
    const a = Buffer.from(p.c);
    const b = Buffer.from(challengeFor(verifier));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return p.u;
  } catch {
    return null;
  }
}
