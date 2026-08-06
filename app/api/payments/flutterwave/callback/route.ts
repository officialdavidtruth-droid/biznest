import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
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

  const order = await prisma.order.findUnique({ where: { id: txRef }, include: { store: true } });
  if (!order) {
    return NextResponse.redirect(`${APP_URL}/?payment=order_not_found`);
  }

  if (status === "cancelled") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    return NextResponse.redirect(`${APP_URL}/store/${order.store.slug}?payment=failed`);
  }

  // Always verify server-side against Flutterwave directly, and re-check
  // the amount — never trust the redirect alone.
  const verification = await verifyFlutterwaveTransaction(transactionId);
  const amountMatches = verification.data && Number(verification.data.amount) >= Number(order.total);

  if (verification.status === "success" && verification.data?.status === "successful" && amountMatches) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentReference: txRef },
    });
    return NextResponse.redirect(`${APP_URL}/store/${order.store.slug}/orders/${order.id}/confirmation`);
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  return NextResponse.redirect(`${APP_URL}/store/${order.store.slug}?payment=failed`);
}
