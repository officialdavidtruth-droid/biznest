/**
 * PIN-based auth for the platform admin panel (/supaadmin), fully decoupled
 * from the regular user/NextAuth system. There is exactly one credential —
 * ADMIN_PIN — shared by whoever runs the platform. There is no per-person
 * login and no roles here: anyone with the PIN gets full access. If you
 * later want distinct logins per team member, this is the wrong building
 * block — you'd want the old PLATFORM_ADMIN/SUPPORT_MODERATOR user-role
 * approach instead.
 *
 * Why not just store the PIN itself in a cookie? Because that's replayable
 * and inspectable. Instead we sign a short-lived token with HMAC-SHA256
 * using a separate server-only secret (ADMIN_PIN_SECRET), and only accept
 * cookies bearing a valid signature. Uses Web Crypto (`crypto.subtle`) —
 * NOT Node's `crypto` module — so this file works unmodified in both
 * Middleware (Edge Runtime) and Server Actions/Route Handlers (Node
 * runtime); both environments expose the same Web Crypto API.
 */

export const ADMIN_COOKIE_NAME = "bn_supaadmin";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret(): string {
  const secret = process.env.ADMIN_PIN_SECRET;
  if (!secret) {
    throw new Error("ADMIN_PIN_SECRET is not set. Generate one and add it to your environment variables.");
  }
  return secret;
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("base64url");
}

/** Issues a signed token: `${expiryTimestamp}.${signature}`. */
export async function createAdminToken(): Promise<string> {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = String(expires);
  const sig = await hmac(payload, getSecret());
  return `${payload}.${sig}`;
}

/** Verifies a token's signature and expiry. Never throws — returns boolean. */
export async function verifyAdminToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  try {
    const expectedSig = await hmac(payload, getSecret());
    // Lengths are fixed (base64url of a 32-byte HMAC), so a simple
    // constant-time-ish comparison via a loop is enough here — timing
    // attacks against a token this short-lived and rotated this often
    // are not a realistic concern for a single shared admin PIN.
    if (expectedSig.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      diff |= expectedSig.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
