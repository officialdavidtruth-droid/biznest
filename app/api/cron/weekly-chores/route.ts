import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { draftLowStockReorders, sendPayoutDigests } from "@/lib/chores/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Mondays 05:30 UTC: the weekly chores merchants shouldn't have to remember.
 *  - low-stock items -> DRAFT supplier purchase orders (never auto-sent)
 *  - last week's payout reconciliation summary
 */
export const GET = withCronMonitor("weekly-chores", async (_req, ctx) => {
  const reorders = await draftLowStockReorders();
  const payouts = await sendPayoutDigests();
  if (reorders.failures + payouts.failures > 0) ctx.fail("weekly-chores: some stores failed", { reorders, payouts });
  return NextResponse.json({ reorders, payouts });
});
