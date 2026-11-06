import { APP_URL } from "@/lib/constants/app-url";

export const PLATFORM_BILLING_GATEWAY: "PAYSTACK" | "KORAPAY" = (() => {
  // Switch with BILLING_GATEWAY=PAYSTACK in the environment and a redeploy. Anything else keeps Korapay.
  // (Flutterwave has no plan/app/ads return routes, so it is not offered for billing.)
  return process.env.BILLING_GATEWAY?.trim().toUpperCase() === "PAYSTACK" ? "PAYSTACK" : "KORAPAY";
})();

/** Where the billing gateway sends the customer back after paying for a plan, an app or an ad campaign. */
export function billingCallbackUrl(kind: "subscription" | "plugin" | "ad", query?: Record<string, string>): string {
  const gateway = PLATFORM_BILLING_GATEWAY === "PAYSTACK" ? "paystack" : "korapay";
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : "";
  return `${APP_URL}/api/payments/${gateway}/${kind}-callback${qs}`;
}
