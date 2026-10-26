import { NextResponse } from "next/server";
import { withCronMonitor } from "@/lib/observability/cron";
import { processDuePayouts } from "@/lib/payments/payout";
import { neutralizeLegacySubaccountSplits } from "@/lib/payments/legacy-subaccounts";
import { logError, errorMeta } from "@/lib/observability/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Retries vendor payouts that couldn't go out immediately (the payment hadn't
 * settled into the platform's Paystack balance yet, the store hadn't connected
 * a bank account, a network error) and settles transfers whose webhook never
 * arrived. See lib/payments/payout.ts. Also zeroes the platform percentage on
 * legacy gateway subaccounts (lib/payments/legacy-subaccounts.ts).
 */
export const GET = withCronMonitor("payouts", async () => {
  try {
    const payouts = await processDuePayouts();
    // Separate guard: a gateway hiccup here must never block payouts above.
    const legacySplits = await neutralizeLegacySubaccountSplits().catch((err) => {
      void logError("JOBS", "legacy subaccount sweep failed", errorMeta(err));
      return null;
    });
    return NextResponse.json({ ok: true, ...payouts, legacySplits });
  } catch (err) {
    void logError("JOBS", "payouts cron failed", errorMeta(err));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
});
