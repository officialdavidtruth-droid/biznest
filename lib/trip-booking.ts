/**
 * Trip (travel package) booking — pure helpers shared by the service form,
 * the storefront widget and the server action.
 *
 * A trip is a Service with `isBookable`, no `totalUnits`, and these keys in
 * `Service.attributes` (no schema change needed):
 *   bookingKind   "trip"
 *   tripSeats     seats available per departure date
 *   tripPricing   "person" (price × travelers) | "group" (flat price)
 *   tripDepartures comma-free list of fixed departure dates (YYYY-MM-DD); empty = any future date
 */
export type TripPricing = "person" | "group";

export type TripConfig = {
  seats: number;
  pricing: TripPricing;
  departures: string[];
};

export const TRIP_MAX_TRAVELERS = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDepartureDates(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.map(String) : typeof input === "string" ? input.split(/[\s,;]+/) : [];
  return Array.from(new Set(raw.map((s) => s.trim()).filter((s) => ISO_DATE.test(s)))).sort();
}

export function readTripConfig(attributes: unknown, isBookable = true, totalUnits?: number | null): TripConfig | null {
  if (!isBookable || totalUnits) return null;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return null;
  const a = attributes as Record<string, unknown>;
  if (a.bookingKind !== "trip") return null;
  const seats = Math.floor(Number(a.tripSeats));
  if (!Number.isFinite(seats) || seats < 1) return null;
  return {
    seats,
    pricing: a.tripPricing === "group" ? "group" : "person",
    departures: parseDepartureDates(a.tripDepartures),
  };
}

export function tripTotal(price: number, pricing: TripPricing, travelers: number): number {
  const n = Math.max(1, Math.floor(travelers) || 1);
  return pricing === "group" ? price : price * n;
}
