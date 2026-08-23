/**
 * Sendbox logistics integration — request delivery quotes, create
 * shipments, and track them. Same shape as lib/payments/paystack.ts /
 * flutterwave.ts: one function per API call, each guarded on its required
 * env var so a missing key fails with a clear message instead of a raw
 * fetch error.
 *
 * Sendbox uses separate base URLs for staging (sandbox) and production —
 * SENDBOX_ENV picks between them (see .env.example). Their docs list the
 * Authorization header simply as "Authorization-key", i.e. the raw access
 * token with no "Bearer " prefix.
 *
 * https://docs.sendbox.co/
 */

const SENDBOX_BASE =
  process.env.SENDBOX_ENV === "live"
    ? "https://live.sendbox.co"
    : "https://sandbox.staging.sendbox.co";

function authHeaders(): Record<string, string> | null {
  const accessToken = process.env.SENDBOX_ACCESS_TOKEN;
  if (!accessToken) return null;
  return {
    Authorization: accessToken,
    "Content-Type": "application/json",
  };
}

export type SendboxAddress = {
  first_name: string;
  last_name: string;
  street: string;
  street_line_2?: string;
  city: string;
  state: string;
  country: string; // ISO 2-letter, e.g. "NG"
  post_code?: string;
  phone: string;
  email?: string | null;
  lat?: number;
  lng?: number;
};

export type SendboxItem = {
  name: string;
  item_type: string;
  quantity: number;
  value: number;
  hts_code?: string;
};

type QuoteParams = {
  origin: SendboxAddress;
  destination: SendboxAddress;
  weight: number;
  items: SendboxItem[];
  incoming_option?: "pickup" | "dropoff";
  region?: string;
  service_type?: "international" | "nation-wide" | "local";
};

type QuoteRate = {
  fee: number;
  key: string;
  currency: string;
  delivery_window?: string;
  insurance_fee?: number;
};

type QuoteResponse = {
  status: boolean;
  message?: string;
  rates?: QuoteRate[];
};

/**
 * Request delivery quotes for a shipment before creating it, so the buyer
 * (or the store owner) can see and pick a rate up front.
 */
export async function getSendboxQuotes(params: QuoteParams): Promise<QuoteResponse> {
  const headers = authHeaders();
  if (!headers) {
    return { status: false, message: "Logistics aren't configured yet (missing SENDBOX_ACCESS_TOKEN)." };
  }

  const res = await fetch(`${SENDBOX_BASE}/shipping/shipment_delivery_quote`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      origin: params.origin,
      destination: params.destination,
      weight: params.weight,
      items: params.items,
      incoming_option: params.incoming_option ?? "pickup",
      region: params.region ?? params.origin.country,
      service_type: params.service_type ?? "local",
      channel_code: "api",
    }),
  });

  const data = await res.json();
  return { status: res.ok, ...data };
}

type CreateShipmentParams = {
  origin: SendboxAddress;
  destination: SendboxAddress;
  weight: number;
  dimension: { length: number; width: number; height: number };
  items: SendboxItem[];
  totalValue: number;
  currency?: string;
  serviceCode?: string; // e.g. "standard" — from a rate's `key` in getSendboxQuotes
  pickupDate: string; // ISO date, e.g. "2026-08-24"
  callbackUrl?: string; // webhook to receive tracking updates
  incoming_option?: "pickup" | "dropoff";
  region?: string;
  service_type?: "international" | "nation-wide" | "local";
};

type ShipmentResponse = {
  status: boolean;
  message?: string;
  code?: string; // tracking code
  status_code?: "drafted" | "pending" | string;
  fee?: number;
};

/**
 * Creates a shipment. Sendbox charges the platform's Sendbox wallet at
 * creation time if there's a sufficient balance (status_code: "pending");
 * otherwise the shipment comes back as "drafted" until funded.
 */
export async function createSendboxShipment(params: CreateShipmentParams): Promise<ShipmentResponse> {
  const headers = authHeaders();
  if (!headers) {
    return { status: false, message: "Logistics aren't configured yet (missing SENDBOX_ACCESS_TOKEN)." };
  }

  const res = await fetch(`${SENDBOX_BASE}/shipping/shipments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      origin: params.origin,
      destination: params.destination,
      weight: params.weight,
      dimension: params.dimension,
      items: params.items,
      total_value: params.totalValue,
      currency: params.currency ?? "NGN",
      package_type: "general",
      channel_code: "api",
      incoming_option: params.incoming_option ?? "pickup",
      region: params.region ?? params.origin.country,
      service_type: params.service_type ?? "local",
      service_code: params.serviceCode ?? "standard",
      pickup_date: params.pickupDate,
      customs_option: "recipient",
      ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
    }),
  });

  const data = await res.json();
  return { status: res.ok, ...data };
}

type TrackingEvent = {
  status: { code: string; name: string };
  description: string;
  date_created: string;
  location_description?: string;
};

type TrackingResponse = {
  status: boolean;
  message?: string;
  code?: string;
  status_code?: string;
  events?: TrackingEvent[];
};

/**
 * Looks up the current status and event history for a shipment by its
 * tracking code (the `code` returned from createSendboxShipment).
 */
export async function trackSendboxShipment(trackingCode: string): Promise<TrackingResponse> {
  const headers = authHeaders();
  if (!headers) {
    return { status: false, message: "Logistics aren't configured yet (missing SENDBOX_ACCESS_TOKEN)." };
  }

  const res = await fetch(`${SENDBOX_BASE}/shipping/tracking`, {
    method: "POST",
    headers,
    body: JSON.stringify({ code: trackingCode }),
  });

  const data = await res.json();
  return { status: res.ok, ...data };
}
