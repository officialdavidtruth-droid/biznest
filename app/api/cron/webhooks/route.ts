import { prisma } from "@/lib/prisma";
import { attemptDelivery } from "@/lib/webhooks/dispatch";
import { NextResponse } from "next/server";

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

  const due = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    select: { id: true },
    take: 200, // batch cap so one sweep can't run indefinitely
  });

  for (const { id } of due) {
    await attemptDelivery(id);
  }

  return NextResponse.json({ processed: due.length });
}
