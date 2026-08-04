import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  if (!reference) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  const order = await prisma.order.findUnique({ where: { id: reference }, include: { store: true } });
  if (!order) {
    return NextResponse.redirect(`${APP_URL}/?payment=order_not_found`);
  }

  // Always verify server-side against Paystack directly — the redirect
  // itself is not proof of payment, since it's just a browser navigation.
  const verification = await verifyPaystackTransaction(reference);

  if (verification.status && verification.data?.status === "success") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentReference: reference },
    });
    return NextResponse.redirect(`${APP_URL}/store/${order.store.slug}/orders/${order.id}/confirmation`);
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  return NextResponse.redirect(`${APP_URL}/store/${order.store.slug}?payment=failed`);
}
