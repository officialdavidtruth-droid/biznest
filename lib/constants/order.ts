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
