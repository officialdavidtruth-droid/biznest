/**
 * Last-mile delivery for product orders.
 *
 * The data model is provider-agnostic: an order carries a provider name, an external reference, a status, a
 * tracking URL and the rider's details. Today the only provider is MANUAL (the merchant books a rider
 * themselves - their own dispatcher, Kwik/Gokada app, a bike guy - and records the details here, and the
 * customer gets the tracking link). A partner adapter (e.g. Kwik) plugs in by implementing DeliveryAdapter
 * and registering it in ADAPTERS; nothing else in the app needs to change.
 */

export const DELIVERY_STATUSES = ["BOOKED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

const LABELS: Record<DeliveryStatus, string> = {
  BOOKED: "Rider arranged",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
};

export function isDeliveryStatus(v: unknown): v is DeliveryStatus {
  return typeof v === "string" && (DELIVERY_STATUSES as readonly string[]).includes(v);
}

export function deliveryStatusLabel(status: string): string {
  return isDeliveryStatus(status) ? LABELS[status] : status;
}

/** Tracking links are shown to customers and put in messages, so only plain http(s) URLs are accepted. */
export function cleanTrackingUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type DeliveryBooking = {
  providerRef: string | null;
  trackingUrl: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  status: DeliveryStatus;
};

/** What a partner integration must provide. Not implemented by any partner yet (see file header). */
export interface DeliveryAdapter {
  readonly id: string;
  book(input: {
    pickupAddress: string;
    dropoffAddress: string;
    recipientName: string;
    recipientPhone: string;
    reference: string;
  }): Promise<DeliveryBooking>;
  status(providerRef: string): Promise<DeliveryBooking>;
  cancel(providerRef: string): Promise<void>;
}

export const ADAPTERS: Record<string, DeliveryAdapter> = {};
