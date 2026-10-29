import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { expireLapsedQuotes } from "@/lib/quotes/expiry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily: persist EXPIRED on every SENT quote whose expiry date has passed. */
export const GET = withCronMonitor("quote-expiry", async () => {
  const expired = await expireLapsedQuotes();
  return NextResponse.json({ expired });
});
