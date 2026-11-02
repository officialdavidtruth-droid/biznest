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

export type TripMoney = { total: number; paid: number; balance: number; cost: number; margin: number };
export function tripMoney(trip: { totalPrice: unknown; totalCost: unknown }, payments: { amount: unknown; status: string }[]): TripMoney {
  const total = Number(trip.totalPrice) || 0;
  const cost = Number(trip.totalCost) || 0;
  const paid = payments.filter((p) => p.status === "RECEIVED").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return { total, paid, cost, balance: Math.max(0, total - paid), margin: total - cost };
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

/** Gateways here charge in Naira only; other currencies stay enquiry-only. */
export const canPayOnline = (currency: string) => currency.toUpperCase() === "NGN";
