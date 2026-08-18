import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.biznest.space";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txRef = searchParams.get("tx_ref");
  const transactionId = searchParams.get("transaction_id");
  const status = searchParams.get("status");

  if (!txRef || !txRef.startsWith("SUBUP-") || !transactionId) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`payment-callback:${ip}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);
  }

  // Reference shape: SUBUP-{storeId}-{subscriptionId}-{random}
  const [, storeId, subscriptionId] = txRef.split("-");
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.redirect(`${APP_URL}/?payment=store_not_found`);

  if (status === "cancelled") {
    await prisma.payment.updateMany({
      where: { reference: txRef, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?payment=failed`);
  }

  const verification = await verifyFlutterwaveTransaction(transactionId);

  if (verification.status === "success" && verification.data?.status === "successful") {
    await prisma.store.update({ where: { id: store.id }, data: { subscriptionId } });
    await prisma.payment.updateMany({
      where: { reference: txRef, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
    });
    return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?upgraded=1`);
  }

  await prisma.payment.updateMany({
    where: { reference: txRef, status: "PENDING" },
    data: { status: "FAILED", rawPayload: verification as object },
  });
  return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?payment=failed`);
}
