import type { WebhookEventType } from "@prisma/client";

// The wire name sent in the payload's "event" field and matched against
// WebhookEndpoint.events. Prisma enums can't hold dots, so this is the one
// place that maps DB enum <-> the dotted names from the integration docs
// (order.created, payment.success, etc).
export const WEBHOOK_EVENT_NAMES: Record<WebhookEventType, string> = {
  ORDER_CREATED: "order.created",
  ORDER_PAID: "order.paid",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_FULFILLED: "order.fulfilled",

  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",

  BOOKING_CREATED: "booking.created",
  BOOKING_CONFIRMED: "booking.confirmed",
  BOOKING_CANCELLED: "booking.cancelled",

  CUSTOMER_CREATED: "customer.created",

  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
};

export const WEBHOOK_EVENT_TYPES = Object.keys(WEBHOOK_EVENT_NAMES) as WebhookEventType[];
