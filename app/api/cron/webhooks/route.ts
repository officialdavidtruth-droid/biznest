import { prisma } from "@/lib/prisma";
import { attemptDelivery } from "@/lib/webhooks/dispatch";
import { NextResponse } from "next/server";
import { logError, logInfo, errorMeta } from "@/lib/observability/log";

/**
 * Retries every PENDING webhook delivery whose backoff has elapsed.
 * Configured as a Vercel Cron job (see vercel.json, runs daily at 18:00
 * UTC) with the Authorization header `Bearer ${CRON_SECRET}`, which
 * Vercel sends automatically for cron-triggered requests.
 *
 * This is a safety net, not the primary delivery path: emitWebhookEvent
 * (lib/webhooks/dispatch.ts) always attempts delivery inline the moment
 * an event fires, so most webhooks are delivered immediately with zero
 * involvement from this cron job. This sweep only matters for deliveries
 * that failed and are sitting in exponential backoff (1m up to 6h — see
 * BACKOFF_SCHEDULE_MINUTES in dispatch.ts).
 *
 * Vercel's Hobby plan caps cron jobs at once a day, so this can't actually
 * run "every minute" the way the backoff schedule assumes -- worst case,
 * a delivery that keeps failing could sit for up to ~24h between sweeps
 * instead of being retried within its 6h backoff window. Still strictly
 * better than not running at all (which is what happens with no
 * vercel.json entry), and an owner on Vercel Pro can tighten this
 * schedule to match the backoff cadence with no code change.
 *
 * One more Hobby-plan constraint worth knowing: Vercel functions on Hobby
 * time out at 10s, and this loop can call out to slow/dead subscriber
 * URLs (up to REQUEST_TIMEOUT_MS = 10s each). A sweep with several slow
 * endpoints could get cut off mid-batch. That's safe, not corrupting --
 * each delivery's status is written as it's processed, so anything not
 * reached just waits for tomorrow's sweep -- but it does mean a big
 * backlog drains more slowly on Hobby than the batch cap alone suggests.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    select: { id: true },
    take: 200, // batch cap so one sweep can't run indefinitely
  });

  let failures = 0;
  for (const { id } of due) {
    try {
      await attemptDelivery(id);
    } catch (err) {
      failures++;
      void logError("JOBS", "webhook-retry-sweep: attemptDelivery threw", errorMeta(err, { deliveryId: id }));
    }
  }

  // INFO-level so this doesn't spam System Health as a WARN/ERROR when
  // there's simply nothing due — the "last run" timestamp itself is the
  // signal that this job is alive at all.
  void logInfo("JOBS", "webhook-retry-sweep completed", { processed: due.length, failures }, Date.now() - start);

  return NextResponse.json({ processed: due.length, failures });
}
