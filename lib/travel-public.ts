import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { TRAVEL_PLUGIN_KEY, SEAT_HOLDING_STATUSES, depositFor } from "@/lib/travel";
import { travelOnlinePaymentError } from "@/lib/payments/travel-charge";

export type PublicTravelPackage = {
  id: string; name: string; destination: string; durationDays: number; pricePerPerson: number; currency: string;
  departureDate: string | null; seatsLeft: number | null; inclusions: string | null;
  /** Can be booked and paid online now (gateway can charge its currency, deposit set, seats available). */
  bookable: boolean; depositPercent: number; depositPerPerson: number;
};

/** Open group packages for a storefront. Empty unless the agency has BizNest Travel installed. */
export async function getPublicTravelPackages(storeId: string): Promise<PublicTravelPackage[]> {
  const ent = await getPluginEntitlement(storeId, TRAVEL_PLUGIN_KEY).catch(() => null);
  if (!ent || !ent.allowed || !ent.installed) return [];
  const rows = await prisma.travelPackage.findMany({
    where: { storeId, isActive: true, OR: [{ departureDate: null }, { departureDate: { gte: new Date() } }] },
    orderBy: [{ departureDate: "asc" }, { createdAt: "desc" }], take: 6,
    include: { trips: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } }, select: { travellers: { select: { id: true } } } } },
  });
  const online = new Map<string, boolean>();
  for (const cur of new Set(rows.map((r) => r.currency.toUpperCase()))) online.set(cur, (await travelOnlinePaymentError(storeId, cur)) === null);
  return rows
    .map((p) => {
      const taken = p.trips.reduce((s, t) => s + t.travellers.length, 0);
      const seatsLeft = p.seats > 0 ? Math.max(0, p.seats - taken) : null;
      const price = Number(p.pricePerPerson);
      return {
        bookable: online.get(p.currency.toUpperCase()) === true && p.depositPercent > 0 && price > 0 && seatsLeft !== 0, depositPercent: p.depositPercent, depositPerPerson: depositFor(price, p.depositPercent),
        id: p.id, name: p.name, destination: p.destination, durationDays: p.durationDays, pricePerPerson: Number(p.pricePerPerson), currency: p.currency,
        departureDate: p.departureDate?.toISOString() ?? null, seatsLeft, inclusions: p.inclusions,
      };
    });
}
