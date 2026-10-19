import "server-only";
import { prisma } from "@/lib/prisma";
import { updatePaystackSubaccountPercentage } from "@/lib/payments/paystack";
import { updateFlutterwaveSubaccountSplit } from "@/lib/payments/flutterwave";
import { logError, logInfo } from "@/lib/observability/log";

/**
 * Stores that connected before the Transfer-API payouts still split every
 * charge through a gateway subaccount, and those subaccounts were created with
 * a platform commission percentage. BizNest no longer takes a cut of sales, so
 * until the owner reconnects a bank account (which drops the subaccount, see
 * connectPayoutAccount) we set that percentage to 0 at the gateway: the store
 * keeps the whole amount, exactly like a store on transfers.
 *
 * Idempotent: Store.legacySplitZeroedAt is stamped only when every gateway
 * call for the store succeeded, so a failure is retried on the next sweep.
 * Payments already made keep their own Payment.splitSubaccountCode, so refund
 * handling for them is unaffected.
 */
export async function neutralizeLegacySubaccountSplits(limit = 25): Promise<{ checked: number; zeroed: number; failed: number }> {
  const stores = await prisma.store.findMany({
    where: {
      legacySplitZeroedAt: null,
      OR: [{ paystackSubaccountCode: { not: null } }, { flutterwaveSubaccountId: { not: null } }],
    },
    select: { id: true, paystackSubaccountCode: true, flutterwaveSubaccountId: true },
    take: limit,
  });

  const summary = { checked: stores.length, zeroed: 0, failed: 0 };

  for (const store of stores) {
    let ok = true;

    if (store.paystackSubaccountCode) {
      try {
        const res = await updatePaystackSubaccountPercentage(store.paystackSubaccountCode, 0);
        if (!res.status) {
          ok = false;
          void logError("PAYMENTS", "Couldn't zero legacy Paystack subaccount split", { storeId: store.id, message: res.message });
        }
      } catch (err) {
        ok = false;
        void logError("PAYMENTS", "Legacy Paystack subaccount update threw", { storeId: store.id, message: err instanceof Error ? err.message : String(err) });
      }
    }

    if (store.flutterwaveSubaccountId) {
      try {
        const res = await updateFlutterwaveSubaccountSplit(store.flutterwaveSubaccountId, 0);
        if (res.status !== "success") {
          ok = false;
          void logError("PAYMENTS", "Couldn't zero legacy Flutterwave subaccount split", { storeId: store.id, message: res.message });
        }
      } catch (err) {
        ok = false;
        void logError("PAYMENTS", "Legacy Flutterwave subaccount update threw", { storeId: store.id, message: err instanceof Error ? err.message : String(err) });
      }
    }

    if (ok) {
      await prisma.store.update({ where: { id: store.id }, data: { legacySplitZeroedAt: new Date() } });
      summary.zeroed++;
    } else {
      summary.failed++;
    }
  }

  if (summary.checked > 0) void logInfo("JOBS", "Legacy subaccount split sweep complete", summary);
  return summary;
}
