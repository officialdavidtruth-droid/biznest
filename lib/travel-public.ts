import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { TRAVEL_PLUGIN_KEY, SEAT_HOLDING_STATUSES, depositFor } from "@/lib/travel";
import { travelOnlinePaymentError } from "@/lib/payments/travel-charge";
import { departureCapacity, bookingClosedByCutoff } from "@/lib/travel-growth";

export type PublicTravelPackage = {
  /** Package id. A package with several dates appears once per departure date. */
  id: string; departureId: string | null; name: string; destination: string; durationDays: number; pricePerPerson: number; currency: string;
  departureDate: string | null; seatsLeft: number | null; inclusions: string | null;
  /** Can be booked and paid online now (gateway can charge its currency, deposit set, seats available, cut-off not passed). */
  bookable: boolean; depositPercent: number; depositPerPerson: number;
};

/** Open group departures for a storefront, one entry per date. Empty unless the agency has BizNest Travel installed. */
export async function getPublicTravelPackages(storeId: string): Promise<PublicTravelPackage[]> {
  const ent = await getPluginEntitlement(storeId, TRAVEL_PLUGIN_KEY).catch(() => null);
  if (!ent || !ent.allowed || !ent.installed) return [];
  const now = new Date();
  const rows = await prisma.travelPackage.findMany({
    where: { storeId, isActive: true },
    orderBy: { createdAt: "desc" }, take: 40,
    include: {
      departures: { where: { isActive: true, departureDate: { gte: now } }, orderBy: { departureDate: "asc" } },
      trips: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } }, select: { departureId: true, travellers: { select: { id: true } } } },
    },
  });
  const online = new Map<string, boolean>();
  for (const cur of new Set(rows.map((r) => r.currency.toUpperCase()))) online.set(cur, (await travelOnlinePaymentError(storeId, cur)) === null);
  const out: PublicTravelPackage[] = [];
  for (const p of rows) {
    const held = (departureId: string | null) => p.trips.filter((t) => t.departureId === departureId).reduce((s, t) => s + t.travellers.length, 0);
    const slots: { departureId: string | null; date: Date | null; capacity: number; price: number; cutoffDays: number }[] = [];
    if (!p.departureDate || p.departureDate >= now) slots.push({ departureId: null, date: p.departureDate, capacity: p.seats, price: Number(p.pricePerPerson), cutoffDays: 0 });
    for (const d of p.departures) slots.push({ departureId: d.id, date: d.departureDate, capacity: departureCapacity({ departureSeats: d.seats, packageSeats: p.seats }), price: Number(d.pricePerPerson ?? p.pricePerPerson), cutoffDays: d.cutoffDays });
    for (const sl of slots) {
      const seatsLeft = sl.capacity > 0 ? Math.max(0, sl.capacity - held(sl.departureId)) : null;
      out.push({
        id: p.id, departureId: sl.departureId, name: p.name, destination: p.destination, durationDays: p.durationDays, pricePerPerson: sl.price, currency: p.currency,
        departureDate: sl.date?.toISOString() ?? null, seatsLeft, inclusions: p.inclusions, depositPercent: p.depositPercent, depositPerPerson: depositFor(sl.price, p.depositPercent),
        bookable: online.get(p.currency.toUpperCase()) === true && p.depositPercent > 0 && sl.price > 0 && seatsLeft !== 0 && !bookingClosedByCutoff(sl.date, sl.cutoffDays, now),
      });
    }
  }
  return out.sort((a, b) => (a.departureDate ?? "9999").localeCompare(b.departureDate ?? "9999")).slice(0, 12);
}
