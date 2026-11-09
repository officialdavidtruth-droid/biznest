import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { runSignupReminders, continueSendingCampaigns } from "@/lib/platform-email/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily at 09:00 UTC (10:00 Lagos): emails verified accounts that haven't opened a store
 * (day 1, 3 and 7 after signup), and keeps sending any admin campaign that is mid-send.
 */
export const GET = withCronMonitor("onboarding-reminders", async (_req, ctx) => {
  const reminders = await runSignupReminders();
  const campaigns = await continueSendingCampaigns();
  if (reminders.failures > 0 && reminders.sent === 0) ctx.fail("onboarding-reminders: every reminder failed", reminders);
  return NextResponse.json({ reminders, campaigns });
});
