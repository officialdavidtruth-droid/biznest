import { prisma } from "@/lib/prisma";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

import { APP_URL } from "@/lib/constants/app-url";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  if (!reference || !reference.startsWith("SUBUP-")) {
    return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);
  }

  const ip = getClientIp(req.headers);
  const rate = await checkRateLimit(`payment-callback:${ip}`, 30, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);
  }

  // Reference shape: SUBUP-{storeId}-{subscriptionId}-{random}
  const [, storeId, subscriptionId] = reference.split("-");
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.redirect(`${APP_URL}/?payment=store_not_found`);

  // Always verify server-side against Paystack directly — the redirect
  // itself is not proof of payment.
  const verification = await verifyPaystackTransaction(reference);

  if (verification.status && verification.data?.status === "success") {
    // Defense in depth: verifyPaystackTransaction is keyed by `reference`
    // itself, so an attacker can't get Paystack to report success for a
    // reference they didn't actually pay — but confirm the paid amount
    // (kobo) actually covers this plan's price (naira) before granting it,
    // in case a reference is ever reused/replayed against a different plan.
    const plan = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    const amountMatches = plan && Number(verification.data.amount) >= Math.round(Number(plan.price) * 100);

    if (!plan || !amountMatches) {
      await prisma.payment.updateMany({
        where: { reference, status: "PENDING" },
        data: { status: "FAILED", rawPayload: verification as object },
      });
      return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?payment=failed`);
    }

    // Claim the payment atomically BEFORE granting anything. Without this, the
    // callback URL could be replayed every month to reset subscriptionRenewsAt
    // (free forever) or to re-apply an old plan after a downgrade. The webhook
    // applies the same claim-then-grant, so whichever arrives first wins and
    // the other is a harmless no-op.
    const claimed = await prisma.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload: verification as object, verifiedAt: new Date() },
    });
    if (claimed.count === 0) {
      const done = await prisma.payment.findUnique({ where: { reference }, select: { status: true } });
      return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription${done?.status === "SUCCESSFUL" ? "?upgraded=1" : "?payment=failed"}`);
    }

    // Save the reusable authorization so the renewal cron can charge next
    // month with no card re-entry, and set the next renewal date to exactly
    // one calendar month out from this successful payment.
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);

    await prisma.store.update({
      where: { id: store.id },
      data: {
        subscriptionId,
        paystackAuthorizationCode: verification.data.authorization?.reusable
          ? verification.data.authorization.authorization_code
          : store.paystackAuthorizationCode,
        subscriptionRenewsAt: nextRenewal,
        subscriptionPastDueSince: null,
      },
    });
    return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?upgraded=1`);
  }

  await prisma.payment.updateMany({
    where: { reference, status: "PENDING" },
    data: { status: "FAILED", rawPayload: verification as object },
  });
  return NextResponse.redirect(`${APP_URL}/${store.slug}/admin/subscription?payment=failed`);
}
