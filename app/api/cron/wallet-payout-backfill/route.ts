import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { backfillWalletPayouts } from "@/lib/payments/payout";
import { logError, errorMeta } from "@/lib/observability/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual, NOT scheduled. Pays out wallet booking payments that were made before
 * wallet payments triggered payouts. Defaults to a dry run:
 *   GET /api/cron/wallet-payout-backfill            -> counts + total owed, sends nothing
 *   GET /api/cron/wallet-payout-backfill?apply=1    -> queues and sends them
 * Same auth as the other cron routes (see lib/cron-auth.ts).
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  try {
    const apply = new URL(req.url).searchParams.get("apply") === "1";
    return NextResponse.json({ ok: true, dryRun: !apply, ...(await backfillWalletPayouts({ dryRun: !apply })) });
  } catch (err) {
    void logError("JOBS", "wallet payout backfill failed", errorMeta(err));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
