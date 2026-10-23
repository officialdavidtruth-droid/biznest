/**
 * Date helpers and URL parsing for the hotel storefront's booking flow.
 * Kept free of React/server code so it can be unit tested.
 */

/** YYYY-MM-DD in the viewer's local time (toISOString() would give the UTC date, a day behind just after midnight in Lagos). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s: string | null): s is string => {
  if (!s || !ISO_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

/**
 * Reads ?checkIn=&checkOut=&guests= from the "Check Availability" link.
 * Anything missing or invalid is simply left out, so the caller keeps its
 * defaults. Past check-ins are moved to today, and a check-out that isn't
 * after check-in becomes the next day.
 */
export function parseBookingQuery(
  search: string,
  todayISO: string
): { checkIn?: string; checkOut?: string; guests?: number } {
  const q = new URLSearchParams(search);
  const out: { checkIn?: string; checkOut?: string; guests?: number } = {};

  const ci = q.get("checkIn");
  if (isRealDate(ci)) {
    const checkIn = ci < todayISO ? todayISO : ci;
    const co = q.get("checkOut");
    out.checkIn = checkIn;
    out.checkOut = isRealDate(co) && co > checkIn ? co : addDaysISO(checkIn, 1);
  }

  const guests = Number(q.get("guests"));
  if (Number.isInteger(guests) && guests >= 1 && guests <= 4) out.guests = guests;
  return out;
}
