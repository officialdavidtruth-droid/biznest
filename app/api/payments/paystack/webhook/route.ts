import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction, verifyPaystackWebhookSignature } from "@/lib/payments/paystack";
import { settleInvoicePayment } from "@/lib/actions/invoice";
import { settleQuoteDeposit } from "@/lib/actions/quote";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { NextResponse } from "next/server";
import { settleWalletFunding, settleServiceBookingPayment } from "@/lib/actions/customer-wallet";
import { settleReservationPayment } from "@/lib/actions/pms";
import { settlePluginPurchase } from "@/lib/actions/plugins";

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

  let event: { event?: string; data?: { reference?: string; transfer_code?: string; reason?: string; failures?: unknown } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Vendor payout (Transfer API) outcomes.
  if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
    const ref = event.data?.reference;
    if (ref) {
      const status = event.event === "transfer.success" ? "PAID" : event.event === "transfer.failed" ? "FAILED" : "REVERSED";
      await prisma.payout.updateMany({
        where: { reference: ref, status: { in: ["QUEUED", "PROCESSING", "PAID"] } },
        data: {
          status,
          ...(status === "PAID" ? { paidAt: new Date(), lastError: null } : { lastError: event.data?.reason ?? event.event }),
          ...(event.data?.transfer_code ? { gatewayTransferId: event.data.transfer_code } : {}),
          rawPayload: event as object,
        },
      });
    }
    return NextResponse.json({ received: true });
  }

  // Paystack sends many event types (transfer.success, subscription.*,
  // etc.) — a signed request only proves it came from Paystack, not that
  // it's the event we care about here.
  if (event.event === "charge.failed" && event.data?.reference) {
    const payment = await prisma.payment.findUnique({ where: { reference: event.data.reference } });
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
    if (store.subscriptionId !== subscriptionId) {
      await prisma.store.update({ where: { id: store.id }, data: { subscriptionId } });
    }
    await prisma.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
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
