import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { sendAlert } from "@/lib/observability/alert";
import { NextResponse } from "next/server";
import { logError, logInfo, logWarn, errorMeta } from "@/lib/observability/log";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { verifyFlutterwaveByReference } from "@/lib/payments/flutterwave";
import { verifyKorapayTransaction } from "@/lib/payments/korapay";
import { secretKeyForPayment } from "@/lib/payments/store-gateway";
import { flagPaymentForReview } from "@/lib/payments/review";
import { markPaymentFailed } from "@/lib/payments/pending";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { settleInvoicePayment } from "@/lib/payments/settle-invoice";
import { settleQuoteDeposit } from "@/lib/payments/settle-quote-deposit";
import { settleWalletFunding } from "@/lib/payments/settle-wallet-funding";
import { settleServiceBookingPayment } from "@/lib/payments/settle-service-booking";
import { settleReservationPayment } from "@/lib/payments/settle-reservation";
import { settleTravelPayment } from "@/lib/payments/settle-travel";
import { settleRentPayment } from "@/lib/payments/settle-rent";
import { settleTailoringPayment } from "@/lib/payments/settle-tailoring";
import { settleSubscriptionUpgrade } from "@/lib/payments/settle-subscription";
import { settlePluginPurchase } from "@/lib/payments/settle-plugin-purchase";

/**
 * Safety net for payments whose webhook (and browser callback) never reached us.
 *
 * Finds Payment rows still PENDING after MIN_AGE, asks the gateway directly
 * ("did this reference get paid?"), and if it did, runs the SAME settlement
 * function the webhook would have run. Every settle* function is idempotent
 * (they claim the Payment row with `updateMany where status = PENDING`), so
 * running this alongside a late webhook can never double-credit anything.
 *
 * Configured in vercel.json; Authorization: Bearer ${CRON_SECRET} like every
 * other /api/cron route. Safe to call manually or as often as your plan allows.
 */
export const maxDuration = 60;

const MIN_AGE_MS = 10 * 60_000; // give the normal webhook/callback a head start
const MAX_AGE_MS = 3 * 24 * 60 * 60_000; // older than this: stop polling, a human should look
const FAIL_AFTER_MS = 24 * 60 * 60_000; // gateway says "failed" and it's a day old -> mark FAILED
const BATCH = 100;
const TIME_BUDGET_MS = 50_000;

type Gateway =
  | { state: "paid"; amountNaira: number; currency?: string | null; payload: object }
  | { state: "failed"; payload: object }
  | { state: "unpaid" } // not paid (yet) / never reached the gateway
  | { state: "error" }; // couldn't ask; try again next run

async function askGateway(provider: string, reference: string, key: string | undefined): Promise<Gateway> {
  if (provider === "PAYSTACK") {
    const v = await verifyPaystackTransaction(reference, key);
    if (!v.status) return /not found/i.test(v.message ?? "") ? { state: "unpaid" } : { state: "error" };
    if (v.data?.status === "success") {
      return { state: "paid", amountNaira: Number(v.data.amount ?? 0) / 100, currency: v.data.currency, payload: v as object };
    }
    return v.data?.status === "failed" ? { state: "failed", payload: v as object } : { state: "unpaid" };
  }
  if (provider === "FLUTTERWAVE") {
    const v = await verifyFlutterwaveByReference(reference, key);
    if (v.status !== "success" || !v.data) return /no transaction|not found/i.test(v.message ?? "") ? { state: "unpaid" } : { state: "error" };
    if (v.data.tx_ref !== reference) return { state: "unpaid" };
    if (v.data.status === "successful") {
      return { state: "paid", amountNaira: Number(v.data.amount ?? 0), currency: (v.data as { currency?: string }).currency, payload: v as object };
    }
    return v.data.status === "failed" ? { state: "failed", payload: v as object } : { state: "unpaid" };
  }
  if (provider === "KORAPAY") {
    const v = await verifyKorapayTransaction(reference, key);
    if (v.status !== "success" || !v.data) return { state: "unpaid" }; // Kora 404s for charges never started
    if (v.data.tx_ref !== reference) return { state: "unpaid" };
    if (v.data.status === "successful") return { state: "paid", amountNaira: v.data.amount, currency: v.data.currency, payload: v as object };
    return v.data.status === "failed" ? { state: "failed", payload: v as object } : { state: "unpaid" };
  }
  return { state: "unpaid" };
}

/** Same prefix routing the three webhook routes use. */
async function settle(provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY", reference: string, g: Extract<Gateway, { state: "paid" }>) {
  const { amountNaira: amount, payload } = g;
  if (reference.startsWith("INV-")) return settleInvoicePayment(reference, amount, payload);
  if (reference.startsWith("QDEP-")) return settleQuoteDeposit(reference, amount, payload);
  if (reference.startsWith("WAL-")) return settleWalletFunding(reference, provider, amount, payload);
  if (reference.startsWith("BK-")) return settleServiceBookingPayment(reference, provider, amount, payload);
  if (reference.startsWith("RES-")) return settleReservationPayment(reference, provider, amount, payload);
  if (reference.startsWith("TVL-")) return settleTravelPayment(reference, provider, amount, payload, g.currency);
  if (reference.startsWith("RNT-")) return settleRentPayment(reference, provider, amount, payload, g.currency);
  if (reference.startsWith("TLR-")) return settleTailoringPayment(reference, provider, amount, payload, g.currency);
  if (reference.startsWith("SUBUP-")) return settleSubscriptionUpgrade(reference, amount, payload);
  if (reference.startsWith("PLUG-")) return settlePluginPurchase(reference, amount, payload);
  return settleOrderPayment({ orderId: reference, reference, provider, verifiedAmountNaira: amount, verifiedCurrency: g.currency, payload });
}

export const GET = withCronMonitor("payment-reconciliation", async (_req, ctx) => {

  const started = Date.now();
  const now = Date.now();
  const stuck = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(now - MIN_AGE_MS), gt: new Date(now - MAX_AGE_MS) },
      // Renewals are recorded by their own cron; subscription upgrades are applied inline by the
      // webhook (plan + renewal date), so they are surfaced for a human rather than half-applied here.
      purpose: { notIn: ["SUBSCRIPTION_RENEWAL"] },
    },
    select: { id: true, reference: true, provider: true, purpose: true, usesStoreGateway: true, storeId: true, createdAt: true, rawPayload: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  const stats = { checked: 0, settled: 0, markedFailed: 0, flagged: 0, stillUnpaid: 0, errors: 0, skippedFlagged: 0 };

  for (const p of stuck) {
    if (Date.now() - started > TIME_BUDGET_MS) break; // remaining rows are picked up next run
    // Already flagged for a human (amount mismatch etc.): don't re-check forever.
    if ((p.rawPayload as { reviewReason?: string } | null)?.reviewReason) { stats.skippedFlagged++; continue; }
    stats.checked++;
    try {
      const key = await secretKeyForPayment(p);
      if (key === "") { stats.errors++; continue; } // store's own keys are gone: cannot verify
      const g = await askGateway(p.provider, p.reference, key);

      if (g.state === "error") { stats.errors++; continue; }
      if (g.state === "unpaid") { stats.stillUnpaid++; continue; }
      if (g.state === "failed") {
        if (Date.now() - p.createdAt.getTime() > FAIL_AFTER_MS) { await markPaymentFailed(p.reference); stats.markedFailed++; }
        continue;
      }

      // Money moved but BizNest never recorded it.
      if (p.purpose === "SUBSCRIPTION_UPGRADE") {
        await flagPaymentForReview(p.reference, "paid at gateway but webhook/callback never applied the subscription upgrade", g.payload);
        stats.flagged++;
        continue;
      }
      if (p.provider !== "PAYSTACK" && p.provider !== "FLUTTERWAVE" && p.provider !== "KORAPAY") continue;
      void logWarn("PAYMENTS", "Reconciliation found a paid-but-unrecorded payment", { reference: p.reference, provider: p.provider, purpose: p.purpose });
      await settle(p.provider, p.reference, g);
      stats.settled++;
    } catch (err) {
      stats.errors++;
      void logError("PAYMENTS", "Payment reconciliation failed for a payment", errorMeta(err, { reference: p.reference }));
    }
  }

  if (stats.checked >= 3 && stats.errors === stats.checked) {
    ctx.fail(`Every one of ${stats.checked} checked payments errored — gateway keys or gateway outage?`);
  }
  // Money moved but our webhook/callback never recorded it: the primary payment path is leaking.
  if (stats.settled > 0) {
    await sendAlert({
      key: "payments-missed-webhooks",
      subject: "[BizNest] Paid payments were missed by webhooks",
      body: `${stats.settled} paid payment(s) were only recovered by the reconciliation sweep. Check the Paystack/Flutterwave/Korapay webhook URLs and signatures.`,
      throttleMinutes: 720,
    });
  }
  if (stats.flagged > 0) {
    await sendAlert({
      key: "payments-flagged",
      subject: "[BizNest] Payments flagged for manual review",
      body: `${stats.flagged} payment(s) were paid at the gateway but could not be applied automatically. Review them in the admin panel.`,
      throttleMinutes: 720,
    });
  }

  void logInfo("PAYMENTS", "Payment reconciliation sweep complete", { ...stats, candidates: stuck.length }, Date.now() - started);
  return NextResponse.json({ ok: true, candidates: stuck.length, ...stats });
});
