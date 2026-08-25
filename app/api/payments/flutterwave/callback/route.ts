import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { settleInvoicePayment } from "@/lib/actions/invoice";
import { settleQuoteDeposit } from "@/lib/actions/quote";
import { decrementStockForOrder } from "@/lib/actions/order";
import { buildStoreUrl } from "@/lib/store-url";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

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
      if (isInvoice) await settleInvoicePayment(txRef, verification as object);
      else await settleQuoteDeposit(txRef, verification as object);
      return NextResponse.redirect(isInvoice ? `${APP_URL}/invoices/${id}` : `${APP_URL}/quotes/${id}`);
    }
    return NextResponse.redirect(`${APP_URL}/${isInvoice ? "invoices" : "quotes"}/${id}?payment=failed`);
  }

  const order = await prisma.order.findUnique({ where: { id: txRef }, include: { store: true } });
  if (!order) {
    return NextResponse.redirect(`${APP_URL}/?payment=order_not_found`);
  }

  // The webhook is the authoritative path and may already have resolved
  // this order by the time the browser makes it back here. If it has,
  // route the customer to the right page without re-verifying or
  // mutating anything — a stale/duplicate callback must never be able to
  // cancel an order that's already PAID or further along.
  if (order.status !== "PENDING_PAYMENT") {
    return order.status === "CANCELLED"
      ? NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"))
      : NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
  }

  if (status === "cancelled") {
    await prisma.$transaction([
      prisma.order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED" },
      }),
      prisma.payment.updateMany({
        where: { reference: txRef, status: "PENDING" },
        data: { status: "FAILED" },
      }),
    ]);
    return NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"));
  }

  // Always verify server-side against Flutterwave directly, and re-check
  // the amount — never trust the redirect alone.
  const verification = await verifyFlutterwaveTransaction(transactionId);
  const amountMatches = verification.data && Number(verification.data.amount) >= Number(order.total);

  if (verification.status === "success" && verification.data?.status === "successful" && amountMatches) {
    // Idempotent by design: only transition an order still awaiting
    // payment, and use the update's own affected-row count — not the
    // read above — to decide whether this request actually won the race
    // against a concurrent webhook delivery for the same reference.
    // Payment confirmation, the order transition, and the stock decrement
    // are grouped in one transaction so they can't split across a crash.
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { status: "PAID", paymentReference: txRef },
      });
      await tx.payment.updateMany({
        where: { reference: txRef, status: "PENDING" },
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
    // emailed regardless of which path resolves the order first.
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
    return NextResponse.redirect(buildStoreUrl(order.store, `/orders/${order.id}/confirmation`));
  }

  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    }),
    prisma.payment.updateMany({
      where: { reference: txRef, status: "PENDING" },
      data: { status: "FAILED", rawPayload: verification as object },
    }),
  ]);
  return NextResponse.redirect(buildStoreUrl(order.store, "?payment=failed"));
                }
