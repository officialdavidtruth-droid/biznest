import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.biznest.space";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  if (!reference || !reference.startsWith("SUBUP-")) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  // Reference shape: SUBUP-{storeId}-{subscriptionId}-{random}
  const [, storeId, subscriptionId] = reference.split("-");
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.redirect(`${APP_URL}/?payment=store_not_found`);

  // Always verify server-side against Paystack directly — the redirect
  // itself is not proof of payment.
  const verification = await verifyPaystackTransaction(reference);

  if (verification.status && verification.data?.status === "success") {
    await prisma.store.update({ where: { id: store.id }, data: { subscriptionId } });
    return NextResponse.redirect(`${APP_URL}/store/${store.slug}/admin/subscription?upgraded=1`);
  }

  return NextResponse.redirect(`${APP_URL}/store/${store.slug}/admin/subscription?payment=failed`);
}
