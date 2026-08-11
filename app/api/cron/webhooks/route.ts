import { prisma } from "@/lib/prisma";
import { attemptDelivery } from "@/lib/webhooks/dispatch";
import { NextResponse } from "next/server";
import { logError, logInfo, errorMeta } from "@/lib/observability/log";

/**
 * Retries every PENDING webhook delivery whose backoff has elapsed.
 * Configure as a Vercel Cron job (see vercel.json — runs every minute) with
 * the Authorization header `Bearer ${CRON_SECRET}`, which Vercel sends
 * automatically for cron-triggered requests.
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
