import { prisma } from "@/lib/prisma";
import { syncPaystackPayoutVerification } from "@/lib/actions/store";
import { notifyUser } from "@/lib/notifications/notify";
import { NextResponse } from "next/server";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";

/**
 * Runs daily (see vercel.json, 09:00 UTC). Paystack has no webhook for
 * subaccount KYC verification -- it's a manual dashboard review on their
 * side (confirmed via support, Aug 2026) -- so a store's first payout can
 * sit held indefinitely if nobody happens to click the "Refresh status"
 * button on the payments page. This sweep polls is_verified for every
 * connected-but-unverified store so a merchant's payout releases as soon
 * as Paystack actually approves it, without requiring them to babysit
 * the dashboard.
 *
 * Deliberately conservative: only touches stores that have a Paystack
 * subaccount connected and no payoutVerifiedAt yet. Once verified, a
 * store drops out of this query for good (see syncPaystackPayoutVerification,
 * which stamps payoutVerifiedAt and is shared with the on-demand button).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.store.findMany({
    where: { paystackSubaccountCode: { not: null }, payoutVerifiedAt: null },
    include: { business: true },
    take: 500,
  });

  let verified = 0;
  let stillPending = 0;
  let errored = 0;

  for (const store of pending) {
    if (!store.paystackSubaccountCode) continue; // narrows the type; excluded by the query already
    try {
      const result = await syncPaystackPayoutVerification(store.id, store.paystackSubaccountCode);
      if (!result.status) {
        errored++;
        continue;
      }
      if (result.isVerified) {
        verified++;
        await notifyUser({
          userId: store.business.userId,
          type: "PAYOUT_ACCOUNT_VERIFIED",
          title: "Your payout account is verified",
          body: "Paystack has approved your account. Your held payouts will now be released on the usual T+1 schedule.",
          url: `/${store.slug}/admin/payments`,
        });
      } else {
        stillPending++;
      }
    } catch (err) {
      errored++;
      void logError("JOBS", "Payout verification check failed", errorMeta(err, { storeId: store.id }));
    }
  }

  void logInfo("JOBS", "Payout verification sweep complete", { checked: pending.length, verified, stillPending, errored });
  return NextResponse.json({ checked: pending.length, verified, stillPending, errored });
}
