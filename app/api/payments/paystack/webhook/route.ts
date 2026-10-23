import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction, verifyPaystackWebhookSignature } from "@/lib/payments/paystack";
import { settleInvoicePayment } from "@/lib/payments/settle-invoice";
import { settleQuoteDeposit } from "@/lib/payments/settle-quote-deposit";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { NextResponse } from "next/server";
import { logError } from "@/lib/observability/log";
import { settleWalletFunding } from "@/lib/payments/settle-wallet-funding";
import { settleServiceBookingPayment } from "@/lib/payments/settle-service-booking";
import { settleReservationPayment } from "@/lib/payments/settle-reservation";
import { settlePluginPurchase } from "@/lib/payments/settle-plugin-purchase";
import { applyTransferWebhookEvent, isTransferEvent } from "@/lib/payments/payout";
import { loadStoreCredentials } from "@/lib/payments/store-gateway";

/**
 * Server-to-server payment confirmation from Paystack.
 *
 * The browser callback route (/api/payments/paystack/callback) only fires
 * if the customer's browser makes it back to us after paying — if the tab
 * closes, the connection drops, or the redirect just fails, an order can
 * sit in PENDING_PAYMENT forever even though Paystack was paid. Paystack
 * also POSTs this event directly from their servers the moment a charge
 * settles, regardless of what the customer's browser does, so this is the
 * authoritative path. The callback route stays as-is for the fast-path UX
 * redirect; this one is what actually guarantees an order gets marked PAID.
 *
 * Configure this URL (https://yourdomain.com/api/payments/paystack/webhook)
 * in the Paystack dashboard under Settings -> API Keys & Webhooks.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  // A store that collects with its own Paystack account points ITS webhook at
  // this same route with ?store=<storeId>. Those events are signed with the
  // store's secret key instead of the platform's, and may only ever settle that
  // store's own payments (guarded below).
  const storeId = new URL(req.url).searchParams.get("store");
  let storeSecretKey: string | undefined;
  if (storeId) {
    const creds = await loadStoreCredentials(storeId, "PAYSTACK");
    if (!creds) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    storeSecretKey = creds.secretKey;
  }

  if (!verifyPaystackWebhookSignature(rawBody, signature, storeSecretKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string; transfer_code?: string; reason?: string; failures?: unknown } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Vendor payout (Transfer API) outcomes belong to the platform account only.
  if (storeId && isTransferEvent(event.event)) {
    return NextResponse.json({ received: true });
  }

  // Vendor payout (Transfer API) outcomes. Transition rules live in applyTransferWebhookEvent.
  if (isTransferEvent(event.event)) {
    await applyTransferWebhookEvent(event.event, event.data, event);
    return NextResponse.json({ received: true });
  }

  // Paystack sends many event types (transfer.success, subscription.*,
  // etc.) — a signed request only proves it came from Paystack, not that
  // it's the event we care about here.
  if (event.event === "charge.failed" && event.data?.reference) {
    const payment = await prisma.payment.findUnique({ where: { reference: event.data.reference } });
    if (storeId && (!payment || !payment.usesStoreGateway || payment.storeId !== storeId)) {
      return NextResponse.json({ received: true });
    }
    if (payment?.orderId) {
      const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
      if (order) {
        await emitWebhookEvent("PAYMENT_FAILED", order.storeId, {
          orderId: order.id,
          reference: event.data.reference,
          provider: "PAYSTACK",
        });
      }
    }
    return NextResponse.json({ received: true });
  }

  // Chargebacks pull money back after a payout may already have gone out. Not
  // auto-handled: make it loud so a human can act inside Paystack's response window.
  if (typeof event.event === "string" && event.event.startsWith("charge.dispute.")) {
    void logError("PAYMENTS", `Paystack dispute event: ${event.event}`, { reference: event.data?.reference });
    return NextResponse.json({ received: true });
  }

  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ received: true });
  }

  const reference = event.data.reference;

  // Keep the two worlds apart. A store webhook may only settle that store's own
  // own-gateway payments; the platform webhook never settles store-gateway ones
  // (their money isn't in the platform account).
  const knownPayment = await prisma.payment.findUnique({ where: { reference }, select: { storeId: true, usesStoreGateway: true } });
  if (storeId) {
    if (!knownPayment || !knownPayment.usesStoreGateway || knownPayment.storeId !== storeId) {
      return NextResponse.json({ received: true });
    }
  } else if (knownPayment?.usesStoreGateway) {
    return NextResponse.json({ received: true });
  }

  // Never trust the webhook payload's status alone — re-verify directly
  // against Paystack's API, same discipline as the browser callback.
  const verification = await verifyPaystackTransaction(reference, storeSecretKey);
  if (!verification.status || verification.data?.status !== "success") {
    // If the verify call itself failed for a payment we know about, answer 5xx
    // so Paystack retries; a 200 here would drop a real payment confirmation.
    if (!verification.status) {
      const known = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
      if (known) return NextResponse.json({ error: "Verification unavailable, retry" }, { status: 502 });
    }
    return NextResponse.json({ received: true });
  }

  // Monthly renewals ("RENEW-…", charged by the renewal cron) are recorded by
  // the cron itself. Without this they fell through to the order path and
  // raised a false "needs manual review" alert for every renewal.
  if (reference.startsWith("RENEW-")) {
    return NextResponse.json({ received: true });
  }

  // Subscription-upgrade references look like SUBUP-{storeId}-{subscriptionId}-{random}
  // (see lib/actions/subscription.ts) — distinct from order references,
  // which are just the order's cuid.
  if (reference.startsWith("SUBUP-")) {
    const [, storeId, subscriptionId] = reference.split("-");
    const [store, plan, payment] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId } }),
      subscriptionId ? prisma.subscription.findUnique({ where: { id: subscriptionId } }) : null,
      prisma.payment.findUnique({ where: { reference } }),
    ]);
    const amountNaira = Number(verification.data?.amount ?? 0) / 100;
    const amountMatches = Boolean(plan && amountNaira >= Number(plan.price));
    const paymentMatches = Boolean(payment && Math.abs(Number(payment.amount) - amountNaira) <= 0.01);
    if (!store || !plan || !payment || payment.storeId !== store.id || !amountMatches || !paymentMatches) {
      return NextResponse.json({ received: true });
    }
    // Claim first (same as the browser callback) so a replay or a second
    // delivery can never re-grant the plan or push the renewal date out.
    const claimed = await prisma.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
    });
    if (claimed.count === 0) return NextResponse.json({ received: true });
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    await prisma.store.update({
      where: { id: store.id },
      data: {
        subscriptionId,
        paystackAuthorizationCode: verification.data?.authorization?.reusable
          ? verification.data.authorization.authorization_code
          : store.paystackAuthorizationCode,
        subscriptionRenewsAt: nextRenewal,
        subscriptionPastDueSince: null,
      },
    });
    return NextResponse.json({ received: true });
  }

  if (reference.startsWith("PLUG-")) {
    const amountNaira = Number(verification.data?.amount ?? 0) / 100;
    await settlePluginPurchase(reference, amountNaira, verification as object);
    return NextResponse.json({ received: true });
  }

  // Invoice payments ("INV-{invoiceId}-{random}") and quote deposits
  // ("QDEP-{quoteId}-{random}") are settled by their own action files
  // rather than inline here, since each has its own idempotent
  // side-effects (marking an Invoice PAID, or converting a Quote into a
  // real Order) beyond just flipping the Payment row.
  if (reference.startsWith("INV-")) {
    await settleInvoicePayment(reference, Number(verification.data?.amount ?? 0) / 100, verification as object);
    return NextResponse.json({ received: true });
  }
  if (reference.startsWith("QDEP-")) {
    await settleQuoteDeposit(reference, Number(verification.data?.amount ?? 0) / 100, verification as object);
    return NextResponse.json({ received: true });
  }

  if (reference.startsWith("WAL-") || reference.startsWith("BK-")) {
    const amount = verification.data ? Number(verification.data.amount) / 100 : 0;
    if (reference.startsWith("WAL-")) {
      await settleWalletFunding(reference, "PAYSTACK", amount, verification as object);
    } else {
      await settleServiceBookingPayment(reference, "PAYSTACK", amount, verification as object);
    }
    return NextResponse.json({ received: true });
  }

  if (reference.startsWith("RES-")) {
    const amount = verification.data ? Number(verification.data.amount) / 100 : 0;
    await settleReservationPayment(reference, "PAYSTACK", amount, verification as object);
    return NextResponse.json({ received: true });
  }

  // Order payment: shared settlement path (amount/currency check, late-payment
  // revival, oversell-safe stock, review flagging). See lib/payments/settle-order.ts.
  await settleOrderPayment({
    orderId: reference,
    reference,
    provider: "PAYSTACK",
    verifiedAmountNaira: Number(verification.data?.amount ?? 0) / 100,
    verifiedCurrency: verification.data?.currency,
    payload: verification as object,
  });

  return NextResponse.json({ received: true });
}
