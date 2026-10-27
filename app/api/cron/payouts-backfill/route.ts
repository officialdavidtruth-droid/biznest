import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { backfillMissingOrderPayouts } from "@/lib/payments/payout";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual, secret-protected catch-up for card-paid store orders that never got a
 * vendor payout (settleOrderPayment did not queue one before this fix).
 *
 *   GET /api/cron/payouts-backfill            -> DRY RUN: counts + total owed, pays nothing
 *   GET /api/cron/payouts-backfill?execute=1  -> queues + sends up to `limit` (default 25, max 50) payouts
 *
 * Authorization: Bearer ${CRON_SECRET}, like every other /api/cron route. Run the
 * dry run first and repeat `execute=1` until `found` is 0. Deliberately NOT in
 * vercel.json: this moves money, so a human triggers it.
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const execute = url.searchParams.get("execute") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 25) || 25, 1), 50);
  const result = await backfillMissingOrderPayouts({ dryRun: !execute, limit });
  return NextResponse.json({ ok: true, dryRun: !execute, ...result });
}
