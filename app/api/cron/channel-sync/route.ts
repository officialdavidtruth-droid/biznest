import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { syncConnection } from "@/lib/channels/sync";
import { flushDuePushes } from "@/lib/channels/push";
import { logError, errorMeta } from "@/lib/observability/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pulls every active OTA calendar and delivers queued live pushes. Vercel's own schedule is daily; for
 * near-real-time availability point an external pinger (e.g. cron-job.org,
 * every 15 minutes) at this URL with `Authorization: Bearer $CRON_SECRET`.
 * Least-recently-synced connections go first so a slow channel can't starve the rest.
 */
export const GET = withCronMonitor("channel-sync", async () => {

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
  // Live push: deliver due/retrying snapshots and refresh stale ones.
  const push = await flushDuePushes({ deadlineMs: Math.max(5_000, deadline + 8_000 - Date.now()) }).catch((err) => {
    void logError("JOBS", "Channel push flush crashed", errorMeta(err));
    return null;
  });
  return NextResponse.json({ synced: ok, failed, remaining: Math.max(0, due.length - ok - failed), push });
});
