import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction, verifyFlutterwaveWebhookSignature } from "@/lib/payments/flutterwave";
import { NextResponse } from "next/server";

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
    if (store && store.subscriptionId !== subscriptionId) {
      await prisma.store.update({ where: { id: store.id }, data: { subscriptionId } });
    }
    await prisma.payment.updateMany({
      where: { reference: txRef, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
    });
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
      const result = await prisma.order.updateMany({
        where: { id: txRef, status: "PENDING_PAYMENT" },
        data: { status: "PAID", paymentReference: txRef },
      });
      if (result.count > 0) {
        await prisma.payment.updateMany({
          where: { reference: txRef, status: "PENDING" },
          data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
