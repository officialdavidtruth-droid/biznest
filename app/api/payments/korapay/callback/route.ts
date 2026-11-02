import { prisma } from "@/lib/prisma";
import { verifyKorapayTransaction } from "@/lib/payments/korapay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { settleInvoicePayment } from "@/lib/payments/settle-invoice";
import { customerDocUrl } from "@/lib/documents/share-token";
import { settleQuoteDeposit } from "@/lib/payments/settle-quote-deposit";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { buildStoreUrl } from "@/lib/store-url";
import { NextResponse } from "next/server";
import { flagPaymentForReview } from "@/lib/payments/review";
import { settleWalletFunding } from "@/lib/payments/settle-wallet-funding";
import { settleServiceBookingPayment } from "@/lib/payments/settle-service-booking";
import { settleReservationPayment } from "@/lib/payments/settle-reservation";
import { settleTravelPayment } from "@/lib/payments/settle-travel";

import { APP_URL } from "@/lib/constants/app-url";

/**
 * Browser return from Korapay's hosted checkout (redirect_url).
 *
 * Kora redirects with our own `reference` in the query string. The redirect is
 * NOT proof of payment: we always re-verify with Kora's API. Kora's verify
 * endpoint is keyed by our reference, so the verified charge is inherently the
 * one this reference names; verifyBound still checks the echoed reference so a
 * mismatched response can never settle a different order.
 *
 * Mirrors the Flutterwave callback; the webhook (../webhook) is the
 * server-to-server backstop for when the customer's browser never comes back.
 */
async function verifyBound(reference: string) {
  const v = await verifyKorapayTransaction(reference);
  if (v.status === "success" && v.data?.tx_ref !== reference) {
    return { status: "error", message: "reference does not match the verified transaction." } as typeof v;
  }
  return v;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txRef = searchParams.get("reference") ?? searchParams.get("tx_ref");

  if (!txRef) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`payment-callback:${ip}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);
  }

  // Invoice payments and quote deposits use their own reference prefixes.
  if (txRef.startsWith("INV-") || txRef.startsWith("QDEP-")) {
    const isInvoice = txRef.startsWith("INV-");
    const id = txRef.split("-")[1];
    const verification = await verifyBound(txRef);

    if (verification.status === "success" && verification.data?.status === "successful") {
      if (isInvoice) await settleInvoicePayment(txRef, Number(verification.data?.amount ?? 0), verification as object);
      else await settleQuoteDeposit(txRef, Number(verification.data?.amount ?? 0), verification as object);
      return NextResponse.redirect(await customerDocUrl(APP_URL, isInvoice ? "invoice" : "quote", id));
    }
    return NextResponse.redirect(await customerDocUrl(APP_URL, isInvoice ? "invoice" : "quote", id, { payment: "failed" }));
  }

  // Wallet funding ("WAL-...") and service-booking payments ("BK-...").
  // Kora reports amounts in naira, so no /100 conversion.
  if (txRef.startsWith("WAL-") || txRef.startsWith("BK-")) {
    const verification = await verifyBound(txRef);
    const amount = verification.data ? Number(verification.data.amount) : 0;
    const verifiedPaid = verification.status === "success" && verification.data?.status === "successful";
    let settleError: string | undefined;
    if (verifiedPaid) {
      if (txRef.startsWith("WAL-")) {
        const result = await settleWalletFunding(txRef, "KORAPAY", amount, verification as object);
        if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/account/wallet?funding=success`);
        settleError = result.error;
      } else {
        const result = await settleServiceBookingPayment(txRef, "KORAPAY", amount, verification as object);
        if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/booking/${result.data.bookingId}/confirmation?payment=success`);
        settleError = result.error;
      }
    }

    const bookingId = txRef.startsWith("BK-") ? txRef.split("-")[1] : null;
    const booking = bookingId ? await prisma.booking.findFirst({ where: { id: bookingId }, include: { store: true } }) : null;
    const bookingUrl = (flag: string) => `${APP_URL}/store/${booking!.store.slug}/booking/${booking!.id}/confirmation?payment=${flag}`;

    // The gateway says the money moved but we could not apply it: flag for a human,
    // never mark the payment FAILED (that made it unrecoverable).
    if (verifiedPaid) {
      await flagPaymentForReview(txRef, `KORAPAY verified success but settlement refused: ${settleError ?? "unknown"}`, verification);
      return NextResponse.redirect(booking ? bookingUrl("review") : `${APP_URL}/?payment=review`);
    }

    // Only an explicit gateway "failed" is a failure; pending / unknown / a failed
    // verify call stay PENDING so the webhook or reconciliation cron can still settle.
    const explicitlyFailed = verification.status === "success" && verification.data?.status === "failed";
    if (explicitlyFailed && booking) {
      await prisma.$transaction([
        prisma.payment.updateMany({ where: { reference: txRef, status: "PENDING" }, data: { status: "FAILED", rawPayload: verification as object } }),
        prisma.booking.updateMany({ where: { id: booking.id, paymentStatus: "PENDING" }, data: { paymentStatus: "UNPAID" } }),
      ]);
      return NextResponse.redirect(bookingUrl("failed"));
    }
    if (booking) return NextResponse.redirect(bookingUrl("pending"));
    return NextResponse.redirect(`${APP_URL}/?payment=${explicitlyFailed ? "failed" : "pending"}`);
  }

  if (txRef.startsWith("TVL-")) {
    const verification = await verifyBound(txRef);
    const amount = verification.data ? Number(verification.data.amount) : 0;
    if (verification.status === "success" && verification.data?.status === "successful") {
      const result = await settleTravelPayment(txRef, "KORAPAY", amount, verification as object, verification.data?.currency);
      if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/travel/${txRef}?payment=success`);
    }
    return NextResponse.redirect(`${APP_URL}/?payment=failed`);
  }

  if (txRef.startsWith("RES-")) {
    const verification = await verifyBound(txRef);
    const amount = verification.data ? Number(verification.data.amount) : 0;
    if (verification.status === "success" && verification.data?.status === "successful") {
      const result = await settleReservationPayment(txRef, "KORAPAY", amount, verification as object);
      if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/admin/pms?payment=success`);
    }
    return NextResponse.redirect(`${APP_URL}/?payment=failed`);
  }

  const order = await prisma.order.findUnique({ where: { id: txRef }, include: { store: true } });
  if (!order) {
    return NextResponse.redirect(`${APP_URL}/?payment=order_not_found`);
  }

  // Already resolved (webhook first, or order moved on): route only. A
  // CANCELLED order is still re-verified so a late payment can revive it.
  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") {
    return NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
  }

  if (order.paymentProvider !== "KORAPAY") return NextResponse.redirect(buildStoreUrl(order.store, "?payment=invalid_provider"));

  const verification = await verifyBound(txRef);
  const gatewayStatus = verification.status === "success" ? verification.data?.status : undefined;

  if (gatewayStatus === "successful") {
    const result = await settleOrderPayment({
      orderId: order.id,
      reference: txRef,
      provider: "KORAPAY",
      verifiedAmountNaira: Number(verification.data?.amount ?? 0),
      verifiedCurrency: verification.data?.currency,
      payload: verification as object,
    });
    if (result.outcome === "paid" || result.outcome === "already_paid") {
      return NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
    }
    return NextResponse.redirect(buildStoreUrl(order.store, "?payment=review"));
  }

  // Cancel only on an explicit gateway failure; "processing" stays pending so
  // a slow bank transfer is never cancelled out from under the customer.
  if (gatewayStatus === "failed") {
    await prisma.$transaction([
      prisma.order.updateMany({ where: { id: order.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } }),
      prisma.payment.updateMany({ where: { reference: txRef, status: "PENDING" }, data: { status: "FAILED", rawPayload: verification as object } }),
    ]);
    return NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"));
  }

  return NextResponse.redirect(buildStoreUrl(order.store, "?payment=pending"));
}
