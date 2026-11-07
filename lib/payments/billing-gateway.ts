import { APP_URL } from "@/lib/constants/app-url";

export type BillingGatewayId = "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";

/** Where the gateway sends the customer back after paying for a plan, an app or an ad campaign. */
export function billingCallbackUrl(kind: "subscription" | "plugin" | "ad", query?: Record<string, string>, gateway: BillingGatewayId = "KORAPAY"): string {
  const path = gateway === "PAYSTACK" ? "paystack" : gateway === "FLUTTERWAVE" ? "flutterwave" : "korapay";
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : "";
  return `${APP_URL}/api/payments/${path}/${kind}-callback${qs}`;
}
