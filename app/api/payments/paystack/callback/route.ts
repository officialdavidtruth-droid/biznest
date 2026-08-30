import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { settleInvoicePayment } from "@/lib/actions/invoice";
import { settleQuoteDeposit } from "@/lib/actions/quote";
import { decrementStockForOrder } from "@/lib/actions/order";
import { buildStoreUrl } from "@/lib/store-url";
import { NextResponse } from "next/server";
import { settleWalletFunding, settleServiceBookingPayment } from "@/lib/actions/customer-wallet";
import { settleReservationPayment } from "@/lib/actions/pms";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

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

  // Invoice payments and quote deposits use their own reference prefixes
  // and redirect targets — see settleInvoicePayment/settleQuoteDeposit for
  // why settlement lives in those action files rather than inline here.
  if (reference.startsWith("INV-") || reference.startsWith("QDEP-")) {
    const isInvoice = reference.startsWith("INV-");
    const id = reference.split("-")[1];
    const verification = await verifyPaystackTransaction(reference);

    if (verification.status && verification.data?.status === "success") {
      if (isInvoice) await settleInvoicePayment(reference, verification as object);
      else await settleQuoteDeposit(reference, verification as object);
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
        if (result.success) return NextResponse.redirect(`${APP_URL}/store/${result.data.storeSlug}?booking=${result.data.bookingId}&payment=success`);
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

  // The webhook is the authoritative path and may already have resolved
  // this order by the time the browser makes it back here (webhooks are
  // typically faster than a redirect round-trip). If it has, just route
  // the customer to the right page without re-verifying or mutating
  // anything — re-running the checks below on a stale reload must never
  // be able to cancel an order that's already PAID or further along.
  if (order.status !== "PENDING_PAYMENT") {
    return order.status === "CANCELLED"
      ? NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"))
      : NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
  }

  // Always verify server-side against Paystack directly — the redirect
  // itself is not proof of payment, since it's just a browser navigation.
  const verification = await verifyPaystackTransaction(reference);

  // Never trust that a successful charge paid the right amount — an
  // order's total can change between checkout-init and payment (discount
  // race, admin edit, etc.). Paystack reports amount in kobo; order.total
  // is in naira. Mirrors the equivalent check in the Flutterwave callback.
  const amountMatches = verification.data && Number(verification.data.amount) / 100 >= Number(order.total);

  if (verification.status && verification.data?.status === "success" && amountMatches) {
    // Idempotent by design: only transition an order still awaiting
    // payment, and use the update's own affected-row count — not the
    // read above — to decide whether this request actually won the race
    // against a concurrent webhook delivery for the same reference.
    // Payment confirmation, the order transition, and the stock decrement
    // are grouped in one transaction so they can't split across a crash.
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { status: "PAID", paymentReference: reference },
      });
      await tx.payment.updateMany({
        where: { reference, status: "PENDING" },
        data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
      });
      if (updateResult.count > 0) {
        await decrementStockForOrder(tx, order.id);
      }
      return updateResult;
    });

    // Only this request "won" the transition (guards against a duplicate
    // callback, or the webhook having already handled it first) — fire the
    // same notifications the webhook fires, so the customer/owner get
    // emailed regardless of which path resolves the order first. Mirrors
    // the equivalent block in the Flutterwave callback.
    if (result.count > 0) {
      await emitWebhookEvent("PAYMENT_SUCCESS", order.storeId, {
        orderId: order.id,
        reference,
        provider: "PAYSTACK",
        amount: Number(order.total),
        currency: order.currency,
      });
      await emitWebhookEvent("ORDER_PAID", order.storeId, { orderId: order.id, status: "PAID" });
      void notifyStoreOwnerOfPaidOrder(order.storeId, order.id, Number(order.total), order.currency);
      void notifyCustomerOfPaidOrder(order.id);
    }
    return NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
  }

  // Same guard on the failure path — a webhook that landed between our
  // read above and here may have already marked this PAID; never let a
  // stale/duplicate callback cancel that. Grouped for the same reason as
  // the success path above.
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    }),
    prisma.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "FAILED", rawPayload: verification as object },
    }),
  ]);
  return NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"));
      }
        
