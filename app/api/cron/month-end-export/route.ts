import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { notifyMonthEndExports } from "@/lib/chores/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 1st of each month, 08:00 UTC: tells every store that sold last month its accountant export is ready. */
export const GET = withCronMonitor("month-end-export", async (_req, ctx) => {
  const result = await notifyMonthEndExports();
  if (result.failures > 0) ctx.fail("month-end-export: some stores failed", result);
  return NextResponse.json(result);
});
