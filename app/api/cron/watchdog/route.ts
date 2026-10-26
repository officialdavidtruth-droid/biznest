import { NextResponse } from "next/server";
import { withCronMonitor, checkCronHealth } from "@/lib/observability/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Daily dead-man's-switch (07:30 UTC, after the 03:00-06:00 jobs). Checks that
 * every OTHER scheduled job has recorded a successful run recently and alerts
 * if one is missing or failing. Catches jobs that never started at all, which
 * a job reporting on itself can't.
 */
export const GET = withCronMonitor("watchdog", async (_req, ctx) => {
  const all = await checkCronHealth(new Date(), undefined);
  const bad = all.filter((c) => c.name !== "watchdog" && (c.state === "failing" || c.state === "stale"));
  for (const c of bad) ctx.fail(`${c.name}: ${c.state} — ${c.detail}`);
  return NextResponse.json({ checked: all.length - 1, problems: bad.length });
});
