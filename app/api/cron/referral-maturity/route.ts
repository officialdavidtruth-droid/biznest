import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { matureVendorReferrals, retryVendorReferralWithdrawals } from "@/lib/referrals/vendor-referral";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily at 09:30 UTC (10:30 Lagos): confirms vendor referral rewards whose refund window has ended (or cancels
 * refunded ones), picks up any referred plan payment the live hooks missed, and retries stuck reward withdrawals.
 */
export const GET = withCronMonitor("referral-maturity", async () => {
  const rewards = await matureVendorReferrals();
  const withdrawals = await retryVendorReferralWithdrawals();
  return NextResponse.json({ rewards, withdrawals });
});
