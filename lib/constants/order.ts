import type { OrderStatus } from "@prisma/client";

// An Order row is created the moment a buyer clicks "checkout" — before
// the gateway confirms anything — so we have a reference to charge
// against and reconcile in the callback/webhook. That means
// PENDING_PAYMENT (checkout started, not yet paid) and CANCELLED
// (payment failed/abandoned) rows exist in the DB for carts that were
// never actually paid for. A seller must never see those as real orders:
// it's exactly the gap a dishonest buyer could point to and claim "I paid
// but you cancelled it" when they didn't. Every store-owner-facing query
// (order list, order detail, customer totals, dashboard counts) should
// filter to this list rather than querying orders unfiltered.
export const SELLER_VISIBLE_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "IN_PROGRESS",
  "DELIVERED",
  "COMPLETED",
  "REFUNDED",
  "DISPUTED",
];

// --- Abandoned checkout recovery -----------------------------------------
// A checkout counts as "abandoned" once its Order has sat at
// PENDING_PAYMENT for longer than this without the buyer completing (or the
// gateway callback marking it CANCELLED). No separate "abandoned" status or
// cron job flips a flag -- this is evaluated at read time in
// lib/actions/abandoned-checkout.ts, the same way SELLER_VISIBLE_ORDER_STATUSES
// filters at read time rather than mutating rows.
export const ABANDONED_CHECKOUT_THRESHOLD_MINUTES = 30;

// --- Merchant-driven status transitions -----------------------------------
// Single source of truth for which status a seller may move an order to from
// the dashboard. Enforced server-side in updateOrderStatus; the dashboard
// control reads the same map to decide which buttons to show.
//
// Deliberately absent: PENDING_PAYMENT (confirmed via the payment flow),
// REFUNDED (set by the refund flow), DISPUTED (set by the dispute flow) and
// the terminal states COMPLETED / CANCELLED / REFUNDED.
//
// There is no merchant "cancel" from a paid order: flipping the status would
// leave the customer's money untouched. Cancelling a paid order goes through
// issueRefund (lib/actions/refund.ts), which returns the money and sets
// REFUNDED. CANCELLED is reserved for payments that failed or were abandoned.
export const MERCHANT_ORDER_TRANSITIONS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  PAID: ["IN_PROGRESS"],
  IN_PROGRESS: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};

export function merchantNextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return MERCHANT_ORDER_TRANSITIONS[from] ?? [];
}

export function canMerchantTransition(from: OrderStatus, to: OrderStatus): boolean {
  return merchantNextStatuses(from).includes(to);
}
