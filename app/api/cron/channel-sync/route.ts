import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCronAuth } from "@/lib/cron-auth";
import { syncConnection } from "@/lib/channels/sync";
import { logError, errorMeta } from "@/lib/observability/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pulls every active OTA calendar. Vercel's own schedule is daily; for
 * near-real-time availability point an external pinger (e.g. cron-job.org,
 * every 15 minutes) at this URL with `Authorization: Bearer $CRON_SECRET`.
 * Least-recently-synced connections go first so a slow channel can't starve the rest.
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const due = await prisma.channelConnection.findMany({
    where: { isActive: true, importUrl: { not: null } },
    orderBy: [{ lastSyncAt: { sort: "asc", nulls: "first" } }],
    select: { id: true },
    take: 40,
  });

  const deadline = Date.now() + 50_000;
  let ok = 0;
  let failed = 0;
  for (const c of due) {
    if (Date.now() > deadline) break;
    try {
      const r = await syncConnection(c.id);
      if (r.ok) ok++; else failed++;
    } catch (err) {
      failed++;
      void logError("JOBS", "Channel sync crashed", errorMeta(err, { connectionId: c.id }));
    }
  }
  return NextResponse.json({ synced: ok, failed, remaining: Math.max(0, due.length - ok - failed) });
}
