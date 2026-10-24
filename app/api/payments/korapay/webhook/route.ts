import { prisma } from "@/lib/prisma";
import { verifyKorapayTransaction, verifyKorapayTransfer, verifyKorapayWebhookSignature } from "@/lib/payments/korapay";
import { applyKorapayTransferWebhookEvent } from "@/lib/payments/payout";
import { settleInvoicePayment } from "@/lib/payments/settle-invoice";
import { settleQuoteDeposit } from "@/lib/payments/settle-quote-deposit";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { NextResponse } from "next/server";
import { settleWalletFunding } from "@/lib/payments/settle-wallet-funding";
import { settleServiceBookingPayment } from "@/lib/payments/settle-service-booking";
import { settleReservationPayment } from "@/lib/payments/settle-reservation";

/**
 * Server-to-server confirmation from Korapay (charge.success / charge.failed /
 * transfer.success / transfer.failed).
 *
 * Set this URL in the Kora dashboard (Settings -> API Configuration -> webhook
 * URL, collections and payouts): https://<domain>/api/payments/korapay/webhook
 * Kora signs only the `data` object with your secret key (x-korapay-signature),
 * so there is no separate secret hash to configure.
 *
 * Like the other gateways: the signed payload only proves who sent it, so every
 * charge and payout is re-verified against Kora's API before anything settles.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-korapay-signature");

  let event: { event?: string; data?: { reference?: string; status?: string; message?: string; amount?: number | string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!verifyKorapayWebhookSignature(signature, event.data)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ received: true });

  // Vendor payout outcome. Re-verify with Kora; 5xx so Kora retries if we can't confirm.
  if (event.event === "transfer.success" || event.event === "transfer.failed") {
    const verified = await verifyKorapayTransfer(reference);
    if (!verified.status || !verified.data) {
      if (verified.notFound) return NextResponse.json({ received: true });
      return NextResponse.json({ error: "Verification unavailable, retry" }, { status: 502 });
    }
    if (verified.data.reference && verified.data.reference !== reference) return NextResponse.json({ received: true });
    await applyKorapayTransferWebhookEvent(verified.data, { event, verified });
    return NextResponse.json({ received: true });
  }

  if (event.event === "charge.failed") {
    const payment = await prisma.payment.findUnique({ where: { reference } });
    if (payment?.orderId) {
      const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
      if (order) {
        await emitWebhookEvent("PAYMENT_FAILED", order.storeId, { orderId: order.id, reference, provider: "KORAPAY" });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.event !== "charge.success") return NextResponse.json({ received: true });

  // Never trust the webhook payload's amount/status alone: re-verify with Kora.
  const verification = await verifyKorapayTransaction(reference);
  if (verification.status !== "success") {
    // Couldn't reach Kora: 5xx so the webhook is retried instead of dropped.
    return NextResponse.json({ error: "Verification unavailable, retry" }, { status: 502 });
  }
  if (verification.data?.status !== "successful" || verification.data.tx_ref !== reference) {
    return NextResponse.json({ received: true });
  }
  const amount = Number(verification.data.amount ?? 0);

  // Only references this platform created through Korapay may settle here.
  const known = await prisma.payment.findUnique({ where: { reference }, select: { provider: true, usesStoreGateway: true } });
  if (!known || known.provider !== "KORAPAY" || known.usesStoreGateway) {
    return NextResponse.json({ received: true });
  }

  if (reference.startsWith("INV-")) {
    await settleInvoicePayment(reference, amount, verification as object);
    return NextResponse.json({ received: true });
  }
  if (reference.startsWith("QDEP-")) {
    await settleQuoteDeposit(reference, amount, verification as object);
    return NextResponse.json({ received: true });
  }
  if (reference.startsWith("WAL-")) {
    await settleWalletFunding(reference, "KORAPAY", amount, verification as object);
    return NextResponse.json({ received: true });
  }
  if (reference.startsWith("BK-")) {
    await settleServiceBookingPayment(reference, "KORAPAY", amount, verification as object);
    return NextResponse.json({ received: true });
  }
  if (reference.startsWith("RES-")) {
    await settleReservationPayment(reference, "KORAPAY", amount, verification as object);
    return NextResponse.json({ received: true });
  }
  // Subscription / plugin charges are pinned to Paystack and never reach here.
  if (reference.startsWith("SUBUP-") || reference.startsWith("PLUG-")) {
    return NextResponse.json({ received: true });
  }

  // Order payment: shared settlement path.
  await settleOrderPayment({
    orderId: reference,
    reference,
    provider: "KORAPAY",
    verifiedAmountNaira: amount,
    verifiedCurrency: verification.data.currency,
    payload: verification as object,
  });

  return NextResponse.json({ received: true });
}
