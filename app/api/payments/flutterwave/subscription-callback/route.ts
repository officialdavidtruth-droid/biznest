import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

import { APP_URL } from "@/lib/constants/app-url";

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

  // transaction_id and tx_ref are two independently-controllable query
  // params on this GET redirect — verifying transaction_id alone proves
  // *some* payment succeeded, not that it was payment for *this* tx_ref.
  // Without this check, anyone with any successful Flutterwave
  // transaction_id (e.g. from paying for the cheapest plan on their own
  // store) could redirect here with a forged tx_ref encoding any other
  // store's id and any plan's id and get it applied for free. Requiring
  // the verified transaction's own tx_ref to equal the one in the URL
  // ties the two together the way Paystack's reference-keyed verify
  // endpoint already does implicitly.
  const verifiedTxRefMatches = verification.data?.tx_ref === txRef;

  if (
    verification.status === "success" &&
    verification.data?.status === "successful" &&
    verifiedTxRefMatches
  ) {
    // Defense in depth: also confirm the verified amount actually covers
    // the plan being granted, in case tx_ref/amount ever become
    // decoupled some other way (e.g. a manually-replayed reference).
    const plan = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    const amountMatches = plan && Number(verification.data.amount) >= Number(plan.price);

    if (plan && amountMatches) {
      await prisma.store.update({ where: { id: store.id }, data: { subscriptionId } });
      await prisma.payment.updateMany({
        where: { reference: txRef, status: "PENDING" },
        data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
      });
      return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?upgraded=1`);
    }
  }

  await prisma.payment.updateMany({
    where: { reference: txRef, status: "PENDING" },
    data: { status: "FAILED", rawPayload: verification as object },
  });
  return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?payment=failed`);
}
