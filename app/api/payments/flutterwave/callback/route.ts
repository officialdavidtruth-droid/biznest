import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { settleInvoicePayment } from "@/lib/payments/settle-invoice";
import { settleQuoteDeposit } from "@/lib/payments/settle-quote-deposit";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { buildStoreUrl } from "@/lib/store-url";
import { NextResponse } from "next/server";
import { settleWalletFunding } from "@/lib/payments/settle-wallet-funding";
import { settleServiceBookingPayment } from "@/lib/payments/settle-service-booking";
import { settleReservationPayment } from "@/lib/payments/settle-reservation";

import { APP_URL } from "@/lib/constants/app-url";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Flutterwave redirects with tx_ref (ours) and transaction_id (theirs) —
  // we need transaction_id to verify, but tx_ref to find the order.
  const txRef = searchParams.get("tx_ref");
  const transactionId = searchParams.get("transaction_id");
  const status = searchParams.get("status");

  if (!txRef || !transactionId) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`payment-callback:${ip}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);
  }

  // Invoice payments and quote deposits use their own reference prefixes —
  // see the matching branch in the Paystack callback route.
  if (txRef.startsWith("INV-") || txRef.startsWith("QDEP-")) {
    const isInvoice = txRef.startsWith("INV-");
    const id = txRef.split("-")[1];
    const verification = await verifyFlutterwaveTransaction(transactionId);

    if (verification.status === "success" && verification.data?.status === "successful") {
      if (isInvoice) await settleInvoicePayment(txRef, Number(verification.data?.amount ?? 0), verification as object);
      else await settleQuoteDeposit(txRef, Number(verification.data?.amount ?? 0), verification as object);
      return NextResponse.redirect(isInvoice ? `${APP_URL}/invoices/${id}` : `${APP_URL}/quotes/${id}`);
    }
    return NextResponse.redirect(`${APP_URL}/${isInvoice ? "invoices" : "quotes"}/${id}?payment=failed`);
  }

  // Wallet funding ("WAL-{walletId}-{random}") and service-booking payments
  // ("BK-{bookingId}-{random}") settle via their own action file — see the
  // matching branch in the Paystack callback route. Flutterwave already
  // reports amounts in the major currency unit (naira), unlike Paystack's
  // kobo, so no /100 conversion here.
  if (txRef.startsWith("WAL-") || txRef.startsWith("BK-")) {
    const verification = await verifyFlutterwaveTransaction(transactionId);
    const amount = verification.data ? Number(verification.data.amount) : 0;
    if (verification.status === "success" && verification.data?.status === "successful") {
      if (txRef.startsWith("WAL-")) {
        const result = await settleWalletFunding(txRef, "FLUTTERWAVE", amount, verification as object);
        if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/account/wallet?funding=success`);
      } else {
        const result = await settleServiceBookingPayment(txRef, "FLUTTERWAVE", amount, verification as object);
        if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/booking/${result.data.bookingId}/confirmation?payment=success`);
      }
    }
    const bookingId = txRef.startsWith("BK-") ? txRef.split("-")[1] : null;
    if (bookingId) {
      const booking = await prisma.booking.findFirst({ where: { id: bookingId }, include: { store: true } });
      if (booking) {
        await prisma.$transaction([
          prisma.payment.updateMany({ where: { reference: txRef, status: "PENDING" }, data: { status: "FAILED", rawPayload: verification as object } }),
          prisma.booking.updateMany({ where: { id: booking.id, paymentStatus: "PENDING" }, data: { paymentStatus: "UNPAID" } }),
        ]);
        return NextResponse.redirect(`${APP_URL}/store/${booking.store.slug}/booking/${booking.id}/confirmation?payment=failed`);
      }
    }
    return NextResponse.redirect(`${APP_URL}/?payment=failed`);
  }

  if (txRef.startsWith("RES-")) {
    const verification = await verifyFlutterwaveTransaction(transactionId);
    const amount = verification.data ? Number(verification.data.amount) : 0;
    if (verification.status === "success" && verification.data?.status === "successful") {
      const result = await settleReservationPayment(txRef, "FLUTTERWAVE", amount, verification as object);
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

  if (order.paymentProvider !== "FLUTTERWAVE") return NextResponse.redirect(buildStoreUrl(order.store, "?payment=invalid_provider"));

  // Always verify server-side; the redirect (including ?status=) is not proof.
  const verification = await verifyFlutterwaveTransaction(transactionId);
  const gatewayStatus = verification.status === "success" ? verification.data?.status : undefined;

  if (gatewayStatus === "successful") {
    const result = await settleOrderPayment({
      orderId: order.id,
      reference: txRef,
      provider: "FLUTTERWAVE",
      verifiedAmountNaira: Number(verification.data?.amount ?? 0),
      verifiedCurrency: (verification.data as { currency?: string } | undefined)?.currency,
      payload: verification as object,
    });
    if (result.outcome === "paid" || result.outcome === "already_paid") {
      return NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
    }
    return NextResponse.redirect(buildStoreUrl(order.store, "?payment=review"));
  }

  // Cancel only on an explicit gateway failure, or when the customer
  // explicitly cancelled on the checkout page and nothing was charged.
  if (gatewayStatus === "failed" || (status === "cancelled" && gatewayStatus !== "pending")) {
    await prisma.$transaction([
      prisma.order.updateMany({ where: { id: order.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } }),
      prisma.payment.updateMany({ where: { reference: txRef, status: "PENDING" }, data: { status: "FAILED", rawPayload: verification as object } }),
    ]);
    return NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"));
  }

  return NextResponse.redirect(buildStoreUrl(order.store, "?payment=pending"));
}
