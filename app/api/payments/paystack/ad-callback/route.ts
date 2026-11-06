import { NextResponse } from "next/server";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { settleAdPayment } from "@/lib/payments/settle-ad";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { APP_URL } from "@/lib/constants/app-url";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const slug = searchParams.get("slug");
  if (!reference || !slug || !reference.startsWith("ADS-")) return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);

  const rate = await checkRateLimit(`ad-payment-callback:${getClientIp(req.headers)}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);

  const verification = await verifyPaystackTransaction(reference);
  if (!verification.status || verification.data?.status !== "success") {
    return NextResponse.redirect(`${APP_URL}/store/${slug}/admin/ads?payment=failed`);
  }
  const result = await settleAdPayment(reference, Number(verification.data.amount ?? 0) / 100, verification as object);
  if (!result.success) return NextResponse.redirect(`${APP_URL}/store/${slug}/admin/ads?payment=failed`);
  return NextResponse.redirect(`${APP_URL}/store/${result.data.slug}/admin/ads?payment=success`);
}
