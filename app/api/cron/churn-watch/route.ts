import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { runChurnWatch } from "@/lib/churn/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily at 10:00 UTC (11:00 Lagos): flags stores showing early churn signs
 * (no login 7d, no orders 14d, failed payment, unused paid app) and nudges
 * the owner once per quiet spell. Results are visible at /supaadmin/at-risk.
 */
export const GET = withCronMonitor("churn-watch", async (_req, ctx) => {
  const result = await runChurnWatch();
  if (result.failures > 0 && result.failures === result.scanned) ctx.fail("churn-watch failed for every store");
  return NextResponse.json(result);
});
