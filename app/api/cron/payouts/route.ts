import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
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
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
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
}
