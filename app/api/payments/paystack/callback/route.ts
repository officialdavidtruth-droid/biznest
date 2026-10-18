import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { settleInvoicePayment } from "@/lib/actions/invoice";
import { settleQuoteDeposit } from "@/lib/actions/quote";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { buildStoreUrl } from "@/lib/store-url";
import { NextResponse } from "next/server";
import { settleWalletFunding, settleServiceBookingPayment } from "@/lib/actions/customer-wallet";
import { settleReservationPayment } from "@/lib/actions/pms";
import { settlePluginPurchase } from "@/lib/actions/plugins";

import { APP_URL } from "@/lib/constants/app-url";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  // This is an unauthenticated redirect target, so key by IP rather than
  // reference — an attacker probing many references from one IP is exactly
  // what this should catch. 30/min is generous for real checkout traffic.
  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`payment-callback:${ip}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);
  }

  if (reference.startsWith("PLUG-")) {
    const verification = await verifyPaystackTransaction(reference);
    if (verification.status && verification.data?.status === "success") {
      const amountNaira = Number(verification.data?.amount ?? 0) / 100;
      const result = await settlePluginPurchase(reference, amountNaira, verification as object);
      if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.slug}/admin/apps/${result.data.pluginKey}?payment=success`);
    }
    const storeId = reference.split("-")[1];
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { slug: true } });
    return NextResponse.redirect(store ? `${APP_URL}/store/${store.slug}/admin/apps?payment=failed` : `${APP_URL}/?payment=failed`);
  }

  // Invoice payments and quote deposits use their own reference prefixes
  // and redirect targets — see settleInvoicePayment/settleQuoteDeposit for
  // why settlement lives in those action files rather than inline here.
  if (reference.startsWith("INV-") || reference.startsWith("QDEP-")) {
    const isInvoice = reference.startsWith("INV-");
    const id = reference.split("-")[1];
    const verification = await verifyPaystackTransaction(reference);

    if (verification.status && verification.data?.status === "success") {
      if (isInvoice) await settleInvoicePayment(reference, Number(verification.data?.amount ?? 0) / 100, verification as object);
      else await settleQuoteDeposit(reference, Number(verification.data?.amount ?? 0) / 100, verification as object);
      return NextResponse.redirect(isInvoice ? `${APP_URL}/invoices/${id}` : `${APP_URL}/quotes/${id}`);
    }
    return NextResponse.redirect(`${APP_URL}/${isInvoice ? "invoices" : "quotes"}/${id}?payment=failed`);
  }

  if (reference.startsWith("WAL-") || reference.startsWith("BK-")) {
    const verification = await verifyPaystackTransaction(reference);
    const amount = verification.data ? Number(verification.data.amount) / 100 : 0;
    if (verification.status && verification.data?.status === "success") {
      if (reference.startsWith("WAL-")) {
        const result = await settleWalletFunding(reference, "PAYSTACK", amount, verification as object);
        if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/account/wallet?funding=success`);
      } else {
        const result = await settleServiceBookingPayment(reference, "PAYSTACK", amount, verification as object);
        if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/booking/${result.data.bookingId}/confirmation?payment=success`);
      }
    }
    const bookingId = reference.startsWith("BK-") ? reference.split("-")[1] : null;
    if (bookingId) {
      const booking = await prisma.booking.findFirst({ where: { id: bookingId }, include: { store: true } });
      if (booking) {
        await prisma.$transaction([
          prisma.payment.updateMany({ where: { reference: reference, status: "PENDING" }, data: { status: "FAILED", rawPayload: verification as object } }),
          prisma.booking.updateMany({ where: { id: booking.id, paymentStatus: "PENDING" }, data: { paymentStatus: "UNPAID" } }),
        ]);
        return NextResponse.redirect(`${APP_URL}/store/${booking.store.slug}/booking/${booking.id}/confirmation?payment=failed`);
      }
    }
    return NextResponse.redirect(`${APP_URL}/?payment=failed`);
  }

  if (reference.startsWith("RES-")) {
    const verification = await verifyPaystackTransaction(reference);
    const amount = verification.data ? Number(verification.data.amount) / 100 : 0;
    if (verification.status && verification.data?.status === "success") {
      const result = await settleReservationPayment(reference, "PAYSTACK", amount, verification as object);
      if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}/admin/pms?payment=success`);
    }
    return NextResponse.redirect(`${APP_URL}/?payment=failed`);
  }

  const order = await prisma.order.findUnique({ where: { id: reference }, include: { store: true } });
  if (!order) {
    return NextResponse.redirect(`${APP_URL}/?payment=order_not_found`);
  }

  // Already resolved (webhook got here first, or order moved on): route only.
  // A CANCELLED order is still re-verified below, because a late successful
  // payment must revive it rather than leave a charged customer cancelled.
  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") {
    return NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
  }

  if (order.paymentProvider !== "PAYSTACK") return NextResponse.redirect(buildStoreUrl(order.store, "?payment=invalid_provider"));

  // The redirect itself is not proof of payment: verify with Paystack.
  const verification = await verifyPaystackTransaction(reference);
  const gatewayStatus = verification.status ? verification.data?.status : undefined;

  if (gatewayStatus === "success") {
    const result = await settleOrderPayment({
      orderId: order.id,
      reference,
      provider: "PAYSTACK",
      verifiedAmountNaira: Number(verification.data?.amount ?? 0) / 100,
      verifiedCurrency: verification.data?.currency,
      payload: verification as object,
    });
    if (result.outcome === "paid" || result.outcome === "already_paid") {
      return NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
    }
    // Money moved but couldn't be applied (e.g. amount mismatch): flagged for
    // review, order left untouched. Never cancel on a successful charge.
    return NextResponse.redirect(buildStoreUrl(order.store, "?payment=review"));
  }

  // Cancel ONLY when Paystack explicitly says the charge failed. Abandoned,
  // ongoing/pending (bank transfer, USSD) or a failed verify call are not
  // failures -- the webhook can still settle them.
  if (gatewayStatus === "failed") {
    await prisma.$transaction([
      prisma.order.updateMany({ where: { id: order.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } }),
      prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED", rawPayload: verification as object } }),
    ]);
    return NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"));
  }

  return NextResponse.redirect(buildStoreUrl(order.store, gatewayStatus === "abandoned" ? "?payment=failed" : "?payment=pending"));
}
