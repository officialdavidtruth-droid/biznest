import { resolveSubscriptionId } from "@/lib/payments/subscription-reference";
import { prisma } from "@/lib/prisma";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { settleSubscriptionUpgrade } from "@/lib/payments/settle-subscription";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/constants/app-url";

/** Browser return from Flutterwave after paying for a BizNest plan ("SUBUP-..."). Re-verified with Flutterwave; the webhook is the backstop. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txRef = searchParams.get("tx_ref");
  const transactionId = searchParams.get("transaction_id");
  const status = searchParams.get("status");

  if (!txRef || !txRef.startsWith("SUBUP-") || !transactionId) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  const rate = await checkRateLimit(`payment-callback:${getClientIp(req.headers)}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);

  // Reference shape: SUBUP-{storeId}-{subscriptionId}-{random}
  const [, storeId] = txRef.split("-");
  const store = storeId ? await prisma.store.findUnique({ where: { id: storeId } }) : null;
  if (!store) return NextResponse.redirect(`${APP_URL}/?payment=store_not_found`);
  const back = `${APP_URL}/store/${store.slug}/admin/subscription`;

  if (status === "cancelled") {
    await prisma.payment.updateMany({ where: { reference: txRef, status: "PENDING" }, data: { status: "FAILED" } });
    return NextResponse.redirect(`${back}?payment=failed`);
  }

  const verification = await verifyFlutterwaveTransaction(transactionId);
  // transaction_id and tx_ref are two independent query params: the verified transaction must be the one this tx_ref names,
  // otherwise any successful payment id could be used to claim a plan for another store.
  if (verification.status === "success" && verification.data?.status === "successful" && verification.data.tx_ref === txRef) {
    const result = await settleSubscriptionUpgrade(txRef, Number(verification.data.amount ?? 0), verification as object);
    if (result.outcome === "upgraded" || result.outcome === "already") return NextResponse.redirect(`${back}?upgraded=1`);
    return NextResponse.redirect(`${back}?payment=${result.outcome === "review" ? "review" : "failed"}`);
  }

  // Only an explicit gateway "failed" is a failure; pending/unknown stays PENDING for the webhook and reconciliation job.
  if (verification.status === "success" && verification.data?.status === "failed") {
    await prisma.payment.updateMany({ where: { reference: txRef, status: "PENDING" }, data: { status: "FAILED", rawPayload: verification as object } });
    return NextResponse.redirect(`${back}?payment=failed`);
  }
  return NextResponse.redirect(`${back}?payment=pending`);
}
