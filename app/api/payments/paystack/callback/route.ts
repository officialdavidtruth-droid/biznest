import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { settleInvoicePayment } from "@/lib/actions/invoice";
import { settleQuoteDeposit } from "@/lib/actions/quote";
import { decrementStockForOrder } from "@/lib/actions/order";
import { buildStoreUrl } from "@/lib/store-url";
import { NextResponse } from "next/server";

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

  if (verification.status && verification.data?.status === "success") {
    // Idempotent by design: only transition an order still awaiting
    // payment, and use the update's own affected-row count — not the
    // read above — to decide whether this request actually won the race
    // against a concurrent webhook delivery for the same reference.
    // Payment confirmation, the order transition, and the stock decrement
    // are grouped in one transaction so they can't split across a crash.
    await prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING_PAYMENT" },
        data: { status: "PAID", paymentReference: reference },
      });
      await tx.payment.updateMany({
        where: { reference, status: "PENDING" },
        data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
      });
      if (result.count > 0) {
        await decrementStockForOrder(tx, order.id);
      }
    });
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
