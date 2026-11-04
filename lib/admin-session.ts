import "server-only";
import { prisma } from "@/lib/prisma";
import { adminSessionIdFromToken, verifyAdminToken } from "@/lib/admin-pin-auth";

/**
 * Server-side half of the SupaAdmin session (Node runtime only -- middleware cannot reach the database).
 *
 * The signed cookie alone stays valid for 12 hours even after "Sign out", so a stolen cookie would keep
 * working. Signing out also records the session id here, and every server action / admin route checks it.
 * Revocations reuse the RateLimitEntry table (key = admin-revoked:<id>, expiring with the token), so no migration.
 */
const REVOKED_PREFIX = "admin-revoked:";
const REVOKE_TTL_MS = 13 * 60 * 60 * 1000; // a little longer than the 12h token lifetime

export async function isAdminSessionRevoked(token: string | undefined | null): Promise<boolean> {
  const id = adminSessionIdFromToken(token);
  if (!id) return true; // old-format tokens carry no id: treat as signed out
  const row = await prisma.rateLimitEntry.findUnique({ where: { key: `${REVOKED_PREFIX}${id}` }, select: { resetAt: true } });
  return !!row && row.resetAt > new Date();
}

/** Valid signature + not expired + not signed out. Use this in server actions and API routes. */
export async function verifyAdminSession(token: string | undefined | null): Promise<boolean> {
  if (!(await verifyAdminToken(token))) return false;
  try {
    return !(await isAdminSessionRevoked(token));
  } catch {
    return false; // can't confirm the session is live -> deny
  }
}

export async function revokeAdminSession(token: string | undefined | null): Promise<void> {
  const id = adminSessionIdFromToken(token);
  if (!id || !(await verifyAdminToken(token))) return;
  const resetAt = new Date(Date.now() + REVOKE_TTL_MS);
  await prisma.rateLimitEntry.upsert({
    where: { key: `${REVOKED_PREFIX}${id}` },
    create: { key: `${REVOKED_PREFIX}${id}`, count: 1, resetAt },
    update: { resetAt },
  });
}
