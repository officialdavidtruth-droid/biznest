import { NextResponse } from "next/server";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { settlePluginPurchase } from "@/lib/payments/settle-plugin-purchase";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { APP_URL } from "@/lib/constants/app-url";

/** Browser return from Flutterwave for a app purchase/renewal ("PLUG-..."). Re-verified with Flutterwave; the webhook is the backstop. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("tx_ref");
  const transactionId = searchParams.get("transaction_id");
  const status = searchParams.get("status");
  const slug = searchParams.get("slug");
  if (!reference || !slug || !transactionId || !reference.startsWith("PLUG-")) return NextResponse.redirect(`${APP_URL}/?payment=missing_reference`);

  const rate = await checkRateLimit(`plugin-payment-callback:${getClientIp(req.headers)}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.redirect(`${APP_URL}/?payment=rate_limited`);

  const back = `${APP_URL}/store/${encodeURIComponent(slug)}/admin/apps`;
  if (status === "cancelled") return NextResponse.redirect(`${back}?payment=failed`);

  const v = await verifyFlutterwaveTransaction(transactionId);
  // The verified transaction must be the one this reference names (the two query params are independent).
  if (v.status !== "success" || v.data?.tx_ref !== reference || v.data?.status !== "successful") {
    return NextResponse.redirect(`${back}?payment=failed`);
  }
  const result = await settlePluginPurchase(reference, Number(v.data.amount ?? 0), v as object);
  if (!result.success) return NextResponse.redirect(`${APP_URL}/store/${slug}/admin/apps?payment=failed`);
  return NextResponse.redirect(`${APP_URL}/store/${result.data.slug}/admin/apps/${result.data.pluginKey}?payment=success`);
}
