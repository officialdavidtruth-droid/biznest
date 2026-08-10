import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction, verifyPaystackWebhookSignature } from "@/lib/payments/paystack";
import { NextResponse } from "next/server";

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

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Paystack sends many event types (transfer.success, subscription.*,
  // etc.) — a signed request only proves it came from Paystack, not that
  // it's the event we care about here.
  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ received: true });
  }

  const reference = event.data.reference;

  // Never trust the webhook payload's status alone — re-verify directly
  // against Paystack's API, same discipline as the browser callback.
  const verification = await verifyPaystackTransaction(reference);
  if (!verification.status || verification.data?.status !== "success") {
    return NextResponse.json({ received: true });
  }

  // Subscription-upgrade references look like SUBUP-{storeId}-{subscriptionId}-{random}
  // (see lib/actions/subscription.ts) — distinct from order references,
  // which are just the order's cuid.
  if (reference.startsWith("SUBUP-")) {
    const [, storeId, subscriptionId] = reference.split("-");
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (store && store.subscriptionId !== subscriptionId) {
      await prisma.store.update({ where: { id: store.id }, data: { subscriptionId } });
    }
    await prisma.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  }

  // Idempotent by design: only transition orders still awaiting payment,
  // via an atomic updateMany rather than read-then-write, so a webhook
  // retry racing the browser callback for the same reference can't both
  // "win" and double-process. The browser callback may have already
  // marked this PAID (whichever path wins the race is fine, both agree),
  // or a store owner may have since moved the order further along the
  // fulfillment pipeline — a late webhook retry must never stomp that.
  await prisma.order.updateMany({
    where: { id: reference, status: "PENDING_PAYMENT" },
    data: { status: "PAID", paymentReference: reference },
  });
  await prisma.payment.updateMany({
    where: { reference, status: "PENDING" },
    data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
  });

  return NextResponse.json({ received: true });
}
