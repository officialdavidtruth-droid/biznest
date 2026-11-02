// Shared constants and pure helpers for the BizNest Travel app (no server-only imports,
// so the client workspace can use them too).

export const TRAVEL_PLUGIN_KEY = "travel-agency";
export const TRAVEL_BUSINESS_TYPE = "Travel & Tourism";

export const TRIP_STATUSES = ["ENQUIRY", "QUOTED", "CONFIRMED", "TICKETED", "TRAVELLING", "COMPLETED", "CANCELLED"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  ENQUIRY: "Enquiry", QUOTED: "Quoted", CONFIRMED: "Confirmed", TICKETED: "Ticketed",
  TRAVELLING: "Travelling", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

export const ITEM_KINDS = ["FLIGHT", "HOTEL", "TRANSFER", "TOUR", "VISA", "INSURANCE", "OTHER"] as const;
export const ITEM_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
export const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "POS", "OTHER"] as const;
export const SUPPLIER_KINDS = ["AIRLINE", "HOTEL", "TOUR_OPERATOR", "TRANSPORT", "INSURER", "CONSOLIDATOR", "OTHER"] as const;
export const VISA_STATUSES = ["DOCUMENTS", "SUBMITTED", "APPOINTMENT", "DECISION_PENDING", "APPROVED", "REFUSED"] as const;
export const VISA_STATUS_LABEL: Record<(typeof VISA_STATUSES)[number], string> = {
  DOCUMENTS: "Collecting documents", SUBMITTED: "Submitted", APPOINTMENT: "Appointment booked",
  DECISION_PENDING: "Awaiting decision", APPROVED: "Approved", REFUSED: "Refused",
};
export const VISA_TYPES = ["TOURIST", "BUSINESS", "STUDENT", "TRANSIT", "FAMILY", "OTHER"] as const;

export const DEFAULT_VISA_CHECKLIST = [
  "Valid passport (6+ months)", "Passport photographs", "Completed application form",
  "Bank statements", "Travel itinerary / flight booking", "Hotel booking or invitation letter", "Visa fee paid",
];

/** Allowed forward/backward moves between trip statuses. CANCELLED is reachable from anywhere open. */
export function canMoveTrip(from: TripStatus, to: TripStatus): boolean {
  if (from === to) return false;
  if (from === "CANCELLED" || from === "COMPLETED") return false;
  if (to === "CANCELLED") return true;
  return TRIP_STATUSES.indexOf(to) >= 0;
}

export function newTripReference(now = new Date(), seq = 0): string {
  const y = String(now.getUTCFullYear()).slice(2);
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TRV-${y}${m}-${rand}${seq ? seq : ""}`;
}

export type TripMoney = { total: number; paid: number; balance: number; cost: number; margin: number; refunded: number };

/** What the agency actually holds from one payment: the amount minus anything refunded. Only RECEIVED payments count. */
export function netReceived(p: { amount: unknown; status: string; refundedAmount?: unknown }): number {
  if (p.status !== "RECEIVED") return 0;
  return Math.max(0, Math.round(((Number(p.amount) || 0) - (Number(p.refundedAmount) || 0)) * 100) / 100);
}

export function tripMoney(trip: { totalPrice: unknown; totalCost: unknown }, payments: { amount: unknown; status: string; refundedAmount?: unknown }[]): TripMoney {
  const total = Number(trip.totalPrice) || 0;
  const cost = Number(trip.totalCost) || 0;
  const paid = payments.reduce((s, p) => s + netReceived(p), 0);
  const refunded = payments.filter((p) => p.status === "RECEIVED" || p.status === "REFUNDED").reduce((s, p) => s + (Number(p.refundedAmount) || 0), 0);
  return { total, paid, cost, balance: Math.max(0, total - paid), margin: total - cost, refunded };
}

/**
 * Validates a refund request against one payment. One refund per payment: partial refunds are allowed
 * (the agency keeps the rest, e.g. a cancellation fee) but a second refund on the same payment is not.
 */
export function checkRefundAmount(payment: { amount: unknown; status: string; refundedAmount?: unknown }, requested: unknown): { ok: true; amount: number; full: boolean } | { ok: false; error: string } {
  if (payment.status !== "RECEIVED") return { ok: false, error: "Only a received payment can be refunded." };
  if ((Number(payment.refundedAmount) || 0) > 0) return { ok: false, error: "This payment has already been refunded." };
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Enter a refund amount greater than zero." };
  const amount = Math.round(n * 100) / 100;
  const paid = Math.round((Number(payment.amount) || 0) * 100) / 100;
  if (amount > paid + 0.005) return { ok: false, error: "A refund can't be more than the payment it came from." };
  return { ok: true, amount: Math.min(amount, paid), full: amount >= paid - 0.005 };
}

/** Share of a vendor payout affected by a refund of `refund` out of a `payment` charge (the gateway fee is not refunded, so scale pro rata). */
export function payoutShareOfRefund(payoutAmount: number, payment: number, refund: number): number {
  if (!(payment > 0) || !(payoutAmount > 0) || !(refund > 0)) return 0;
  return Math.round(payoutAmount * Math.min(1, refund / payment) * 100) / 100;
}

/** Days until a date (negative = past). Null when no date. */
export function daysUntil(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

/** Most countries require the passport to be valid for 6 months beyond the return/entry date. */
export function passportWarning(expiry: Date | string | null | undefined, travelDate: Date | string | null | undefined): string | null {
  if (!expiry) return null;
  const e = new Date(expiry);
  if (Number.isNaN(e.getTime())) return null;
  const ref = travelDate ? new Date(travelDate) : new Date();
  const needed = new Date(ref);
  needed.setMonth(needed.getMonth() + 6);
  if (e.getTime() < ref.getTime()) return "Passport expired before travel";
  if (e.getTime() < needed.getTime()) return "Passport valid for under 6 months at travel";
  return null;
}

/** Statuses that hold seats on a group package. Enquiries and quotes are non-binding, so spam can't block a tour. */
export const SEAT_HOLDING_STATUSES = ["CONFIRMED", "TICKETED", "TRAVELLING", "COMPLETED"] as const;

/** Payment-reference prefix for online travel payments. Webhooks and callbacks route settlement on it. */
export const TRAVEL_PAY_PREFIX = "TVL";

/** Deposit due to book: percent of the total, rounded up to the next whole currency unit, never above the total. */
export function depositFor(total: number, percent: number): number {
  const pct = Math.max(0, Math.min(100, Math.floor(Number(percent) || 0)));
  if (!(total > 0) || pct === 0) return 0;
  if (pct === 100) return Math.round(total * 100) / 100;
  return Math.min(total, Math.ceil((total * pct) / 100));
}

/**
 * Currencies each gateway can charge. BizNest's own gateway accounts settle in NGN only; any other
 * currency is charged on the store's OWN Paystack/Flutterwave keys, so the money lands in the agency's
 * account and BizNest never holds or converts it. Add a code here once that gateway account supports it.
 */
export const GATEWAY_CURRENCIES = {
  PAYSTACK: ["NGN", "USD", "GHS", "ZAR", "KES"],
  FLUTTERWAVE: ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"],
  KORAPAY: ["NGN"],
} as const;
export type OnlineGateway = keyof typeof GATEWAY_CURRENCIES;

/** True when online payment can exist for this currency at all (NGN anywhere, others only on a store's own gateway). */
export const canPayOnline = (currency: string) => {
  const c = String(currency ?? "").toUpperCase();
  return c === "NGN" || Object.values(GATEWAY_CURRENCIES).some((list) => (list as readonly string[]).includes(c));
};

/** Exact check once the gateway is known. Returns an error message, or null when the gateway can charge it. */
export function gatewayCurrencyError(currency: string, gateway: OnlineGateway): string | null {
  const c = String(currency ?? "").toUpperCase();
  return (GATEWAY_CURRENCIES[gateway] as readonly string[]).includes(c) ? null : `${gateway.charAt(0)}${gateway.slice(1).toLowerCase()} can't charge ${c} here.`;
}

/**
 * wa.me chat link for a client's phone, with an optional prefilled message. Nigerian local numbers
 * (0801...) are converted to 234801.... Returns null when the number is too short to be real.
 * WhatsApp links can't attach files: staff download the PDF and attach it in the chat.
 */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
