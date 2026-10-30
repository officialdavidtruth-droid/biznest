import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyKorapayTransaction } from "@/lib/payments/korapay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { settleSubscriptionUpgrade } from "@/lib/payments/settle-subscription";
import { APP_URL } from "@/lib/constants/app-url";

/**
 * Browser return from Korapay's hosted checkout for a BizNest plan payment
 * ("SUBUP-..." reference). The redirect is not proof of payment: we re-verify with Kora.
 * The Korapay webhook is the server-to-server backstop.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("tx_ref");
  if (!reference || !reference.startsWith("SUBUP-")) return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);

  const rate = await checkRateLimit(`payment-callback:${getClientIp(req.headers)}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);

  const [, storeId] = reference.split("-");
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { slug: true } });
  if (!store) return NextResponse.redirect(`${APP_URL}/?payment=store_not_found`);
  const page = `${APP_URL}/store/${store.slug}/admin/subscription`;

  const v = await verifyKorapayTransaction(reference);
  const verified = v.status === "success" && v.data?.tx_ref === reference;

  if (verified && v.data?.status === "successful") {
    const result = await settleSubscriptionUpgrade(reference, Number(v.data.amount ?? 0), v as object);
    if (result.outcome === "upgraded" || result.outcome === "already") return NextResponse.redirect(`${page}?upgraded=1`);
    return NextResponse.redirect(`${page}?payment=review`);
  }

  // Only an explicit gateway "failed" is a failure; anything else may still be settled by the webhook.
  if (verified && v.data?.status === "failed") {
    await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED", rawPayload: v as object } });
    return NextResponse.redirect(`${page}?payment=failed`);
  }
  return NextResponse.redirect(`${page}?payment=pending`);
}
