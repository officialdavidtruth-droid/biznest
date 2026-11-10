import type { ChurnKind } from "@/lib/churn/signals";

export type ChurnCopy = { title: string; body: string; href: (slug: string) => string; cta: string };

/** Owner-facing tip for each warning sign: short, specific, one next step. */
export const CHURN_COPY: Record<ChurnKind, ChurnCopy> = {
  NO_LOGIN: {
    title: "We've missed you",
    body: "Your store has been quiet for a week. Customers can still order while you're away. Pop in to check for new orders and messages.",
    href: (s) => `/store/${s}/admin`,
    cta: "Open dashboard",
  },
  NO_ORDERS: {
    title: "Let's get orders moving",
    body: "No orders in the last 10 days. Share your store link on WhatsApp or your status and add a first-time-buyer coupon. Those are the quickest wins.",
    href: (s) => `/store/${s}/admin/coupons`,
    cta: "Create a coupon",
  },
  PAYMENT_FAILED: {
    title: "A payment didn't go through",
    body: "We couldn't renew part of your plan. Update your card to avoid losing access. Your store data is safe.",
    href: (s) => `/store/${s}/admin/subscription`,
    cta: "Fix payment",
  },
  UNUSED_PLUGIN: {
    title: "Getting value from your apps?",
    body: "You have a paid app you haven't used since installing. Open it for a 2-minute setup, or remove it if you don't need it.",
    href: (s) => `/store/${s}/admin/apps`,
    cta: "Review apps",
  },
};
