import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Shared guard for every /api/cron/* route. Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Fails closed: if CRON_SECRET is unset or empty, NOTHING is authorized
 * (previously the comparison became `Bearer undefined`, which any caller
 * could send). The comparison is constant-time.
 *
 * Usage, first line of a cron handler:
 *   const denied = requireCronAuth(req);
 *   if (denied) return denied;
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (!auth) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(auth);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function requireCronAuth(req: Request): NextResponse | null {
  if (!process.env.CRON_SECRET) {
    console.error("[cron] CRON_SECRET is not set; rejecting all cron requests.");
  }
  if (isCronAuthorized(req)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
