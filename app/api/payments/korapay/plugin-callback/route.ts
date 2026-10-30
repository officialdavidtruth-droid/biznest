import { NextResponse } from "next/server";
import { verifyKorapayTransaction } from "@/lib/payments/korapay";
import { settlePluginPurchase } from "@/lib/payments/settle-plugin-purchase";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { APP_URL } from "@/lib/constants/app-url";

/** Browser return from Korapay's hosted checkout for an app purchase/renewal ("PLUG-..."). Re-verified with Kora; the webhook is the backstop. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") ?? searchParams.get("tx_ref");
  const slug = searchParams.get("slug");
  if (!reference || !slug || !reference.startsWith("PLUG-")) return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);

  const rate = await checkRateLimit(`plugin-payment-callback:${getClientIp(req.headers)}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);

  const v = await verifyKorapayTransaction(reference);
  if (v.status !== "success" || v.data?.tx_ref !== reference || v.data?.status !== "successful") {
    return NextResponse.redirect(`${APP_URL}/store/${slug}/admin/apps?payment=failed`);
  }
  const result = await settlePluginPurchase(reference, Number(v.data.amount ?? 0), v as object);
  if (!result.success) return NextResponse.redirect(`${APP_URL}/store/${slug}/admin/apps?payment=failed`);
  return NextResponse.redirect(`${APP_URL}/store/${result.data.slug}/admin/apps/${result.data.pluginKey}?payment=success`);
}
