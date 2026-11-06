import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { logInfo } from "@/lib/observability/log";
import { releaseStaleHolds } from "@/lib/payments/ticket-hold";

/** Daily sweep of unpaid ticket orders. (Buying also releases stale holds for that event, so this is the backstop.) */
export const GET = withCronMonitor("ticket-holds", async () => {
  const start = Date.now();
  const r = await releaseStaleHolds();
  void logInfo("JOBS", "ticket-holds completed", r, Date.now() - start);
  return NextResponse.json({ ok: true, ...r });
});
