import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction, verifyFlutterwaveWebhookSignature } from "@/lib/payments/flutterwave";
import { settleInvoicePayment } from "@/lib/actions/invoice";
import { settleQuoteDeposit } from "@/lib/actions/quote";
import { decrementStockForOrder } from "@/lib/actions/order";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import { NextResponse } from "next/server";
import { settleWalletFunding, settleServiceBookingPayment } from "@/lib/actions/customer-wallet";
import { settleReservationPayment } from "@/lib/actions/pms";

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

  let event: { event?: string; data?: { id?: number; tx_ref?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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
    const plan = subscriptionId ? await prisma.subscription.findUnique({ where: { id: subscriptionId } }) : null;
    const amountMatches = plan && verification.data && Number(verification.data.amount) >= Number(plan.price);
    if (store && plan && amountMatches && store.subscriptionId !== subscriptionId) {
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
    await settleInvoicePayment(txRef, verification as object);
    return NextResponse.json({ received: true });
  }
  if (txRef.startsWith("QDEP-")) {
    await settleQuoteDeposit(txRef, verification as object);
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

  // Idempotent by design — see the matching comment in the Paystack
  // webhook. The amount check still needs the order row, but the actual
  // transition happens via an atomic updateMany so a webhook retry racing
  // the browser callback for the same tx_ref can't both "win".
  const order = await prisma.order.findUnique({ where: { id: txRef } });
  if (order && order.status === "PENDING_PAYMENT") {
    const amountMatches = verification.data && Number(verification.data.amount) >= Number(order.total);
    if (amountMatches) {
      // Same reasoning as the Paystack webhook: group the order
      // transition, the payment row update, and the stock decrement so
      // they can't split across a crash.
      const result = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
          where: { id: txRef, status: "PENDING_PAYMENT" },
          data: { status: "PAID", paymentReference: txRef },
        });
        await tx.payment.updateMany({
          where: { reference: txRef, status: "PENDING" },
          data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
        });
        if (updateResult.count > 0) {
          await decrementStockForOrder(tx, txRef);
        }
        return updateResult;
      });
      if (result.count > 0) {
        await emitWebhookEvent("PAYMENT_SUCCESS", order.storeId, {
          orderId: order.id,
          reference: txRef,
          provider: "FLUTTERWAVE",
          amount: Number(order.total),
          currency: order.currency,
        });
        await emitWebhookEvent("ORDER_PAID", order.storeId, { orderId: order.id, status: "PAID" });
        void notifyStoreOwnerOfPaidOrder(order.storeId, order.id, Number(order.total), order.currency);
        void notifyCustomerOfPaidOrder(order.id);
      }
    }
  }

  return NextResponse.json({ received: true });
        }
    
