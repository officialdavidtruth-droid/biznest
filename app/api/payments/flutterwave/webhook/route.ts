import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction, verifyFlutterwaveTransfer, verifyFlutterwaveWebhookSignature } from "@/lib/payments/flutterwave";
import { applyFlutterwaveTransferWebhookEvent } from "@/lib/payments/payout";
import { settleInvoicePayment } from "@/lib/payments/settle-invoice";
import { settleQuoteDeposit } from "@/lib/payments/settle-quote-deposit";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { NextResponse } from "next/server";
import { settleWalletFunding } from "@/lib/payments/settle-wallet-funding";
import { settleServiceBookingPayment } from "@/lib/payments/settle-service-booking";
import { settleReservationPayment } from "@/lib/payments/settle-reservation";

/**
 * Server-to-server payment confirmation from Flutterwave.
 *
 * Same reasoning as the Paystack webhook alongside it: the browser callback
 * route only fires if the customer's browser makes it back to us, so it
 * can't be the only thing standing between a real payment and an order
 * that's stuck in PENDING_PAYMENT forever. This route is what Flutterwave
 * calls directly from their servers the moment a charge completes.
 *
 * Configure this URL (https://yourdomain.com/api/payments/flutterwave/webhook)
 * in the Flutterwave dashboard under Settings -> Webhooks, and set the same
 * secret hash there and in FLUTTERWAVE_SECRET_HASH.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("verif-hash");

  if (!verifyFlutterwaveWebhookSignature(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { id?: number; tx_ref?: string; reference?: string; status?: string; complete_message?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Vendor payout (Transfer API) outcome. Re-verify with Flutterwave before acting on it,
  // same discipline as charges: the signed payload alone only proves who sent it.
  if (event.event === "transfer.completed") {
    const { id, reference } = event.data ?? {};
    if (!id || !reference) return NextResponse.json({ received: true });
    const verified = await verifyFlutterwaveTransfer(id);
    if (verified.status !== "success" || !verified.data) {
      // Couldn't confirm: answer 5xx so Flutterwave retries rather than dropping the outcome.
      return NextResponse.json({ error: "Verification unavailable, retry" }, { status: 502 });
    }
    if (verified.data.reference !== reference) return NextResponse.json({ received: true });
    await applyFlutterwaveTransferWebhookEvent(verified.data, event);
    return NextResponse.json({ received: true });
  }

  if (event.event === "charge.completed" && event.data?.tx_ref && (event.data as { status?: string }).status !== "successful") {
    const payment = await prisma.payment.findUnique({ where: { reference: event.data.tx_ref } });
    if (payment?.orderId) {
      const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
      if (order) {
        await emitWebhookEvent("PAYMENT_FAILED", order.storeId, {
          orderId: order.id,
          reference: event.data.tx_ref,
          provider: "FLUTTERWAVE",
        });
      }
    }
  }

  if (event.event !== "charge.completed" || !event.data?.id || !event.data?.tx_ref) {
    return NextResponse.json({ received: true });
  }

  const { id: transactionId, tx_ref: txRef } = event.data;

  // Never trust the webhook payload's amount/status alone — re-verify
  // directly against Flutterwave's API, same discipline as the browser
  // callback.
  const verification = await verifyFlutterwaveTransaction(String(transactionId));
  if (verification.status !== "success" || verification.data?.status !== "successful") {
    return NextResponse.json({ received: true });
  }
  // Defense in depth: the verified transaction must be the one this tx_ref names.
  if (verification.data?.tx_ref !== txRef) {
    return NextResponse.json({ received: true });
  }

  // Subscription-upgrade references look like SUBUP-{storeId}-{subscriptionId}-{random}
  // (see lib/actions/subscription.ts) — distinct from order references,
  // which are just the order's cuid.
  if (txRef.startsWith("SUBUP-")) {
    const [, storeId, subscriptionId] = txRef.split("-");
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    // txRef and transactionId both come from this same signed webhook
    // payload, so they're already bound to one real event — this amount
    // check is defense in depth, matching the browser callback, in case a
    // reference is ever replayed against a different plan.
    const [plan, payment] = await Promise.all([
      subscriptionId ? prisma.subscription.findUnique({ where: { id: subscriptionId } }) : null,
      prisma.payment.findUnique({ where: { reference: txRef } }),
    ]);
    const amountNaira = Number(verification.data?.amount ?? 0);
    const amountMatches = Boolean(plan && amountNaira >= Number(plan.price));
    const paymentMatches = Boolean(payment && Math.abs(Number(payment.amount) - amountNaira) <= 0.01);
    if (!store || !plan || !payment || payment.storeId !== store.id || !amountMatches || !paymentMatches) {
      return NextResponse.json({ received: true });
    }
    if (store.subscriptionId !== subscriptionId) {
      await prisma.store.update({ where: { id: store.id }, data: { subscriptionId } });
    }
    await prisma.payment.updateMany({
      where: { reference: txRef, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  }

  // See the matching comment in the Paystack webhook — invoice/quote-deposit
  // settlement lives in their own action files.
  if (txRef.startsWith("INV-")) {
    await settleInvoicePayment(txRef, Number(verification.data?.amount ?? 0), verification as object);
    return NextResponse.json({ received: true });
  }
  if (txRef.startsWith("QDEP-")) {
    await settleQuoteDeposit(txRef, Number(verification.data?.amount ?? 0), verification as object);
    return NextResponse.json({ received: true });
  }

  // Wallet funding ("WAL-{walletId}-{random}") and service-booking payments
  // ("BK-{bookingId}-{random}") settle via their own action file — see the
  // matching branch in the Paystack webhook. Flutterwave already reports
  // amounts in the major currency unit (naira), unlike Paystack's kobo, so
  // no /100 conversion here.
  if (txRef.startsWith("WAL-") || txRef.startsWith("BK-")) {
    const amount = verification.data ? Number(verification.data.amount) : 0;
    if (txRef.startsWith("WAL-")) {
      await settleWalletFunding(txRef, "FLUTTERWAVE", amount, verification as object);
    } else {
      await settleServiceBookingPayment(txRef, "FLUTTERWAVE", amount, verification as object);
    }
    return NextResponse.json({ received: true });
  }

  if (txRef.startsWith("RES-")) {
    const amount = verification.data ? Number(verification.data.amount) : 0;
    await settleReservationPayment(txRef, "FLUTTERWAVE", amount, verification as object);
    return NextResponse.json({ received: true });
  }

  // Order payment: shared settlement path (see lib/payments/settle-order.ts).
  await settleOrderPayment({
    orderId: txRef,
    reference: txRef,
    provider: "FLUTTERWAVE",
    verifiedAmountNaira: Number(verification.data?.amount ?? 0),
    verifiedCurrency: (verification.data as { currency?: string } | undefined)?.currency,
    payload: verification as object,
  });

  return NextResponse.json({ received: true });
}
