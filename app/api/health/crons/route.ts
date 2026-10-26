import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkCronHealth } from "@/lib/observability/cron";

export const dynamic = "force-dynamic";

/**
 * Scheduled-job health, for an EXTERNAL uptime monitor (UptimeRobot, Better
 * Stack...). Returns 503 if any cron is failing or overdue, so you hear about
 * a dead cron even when Vercel Cron itself is what broke.
 *
 *   GET /api/health/crons?key=<HEALTH_CHECK_KEY>
 *
 * "never_run" (fresh deploy, nothing recorded yet) is reported but is not a
 * failure. Without HEALTH_CHECK_KEY set the endpoint is disabled.
 */
function authorized(req: Request): boolean {
  const secret = process.env.HEALTH_CHECK_KEY;
  if (!secret) return false;
  const given = new URL(req.url).searchParams.get("key") ?? "";
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const crons = await checkCronHealth();
    const bad = crons.filter((c) => c.state === "failing" || c.state === "stale");
    return NextResponse.json(
      {
        ok: bad.length === 0,
        problems: bad.map((c) => ({ cron: c.name, state: c.state, detail: c.detail })),
        pending: crons.filter((c) => c.state === "never_run").map((c) => c.name),
        timestamp: new Date().toISOString(),
      },
      { status: bad.length ? 503 : 200 }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "health check failed" }, { status: 503 });
  }
}

export async function HEAD(req: Request) {
  const res = await GET(req);
  return new Response(null, { status: res.status });
}
