import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { sendWeeklyRecaps } from "@/lib/chores/weekly-recap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Mondays 06:30 UTC (07:30 Lagos): one "how your store did this week" recap per store owner. */
export const GET = withCronMonitor("weekly-recap", async (_req, ctx) => {
  const result = await sendWeeklyRecaps();
  if (result.failures > 0) ctx.fail("weekly-recap: some stores failed", result);
  return NextResponse.json(result);
});
