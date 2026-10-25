"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";

export type OccupancyStats = {
  totalUnits: number;
  inHouse: number;
  inHousePct: number;
  bookedTonight: number;
  bookedTonightPct: number;
  arrivalsToday: number;
  departuresToday: number;
};

const pct = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);

/**
 * Occupancy for unit-based stays (hotel rooms, tables, chairs).
 *  - In-house: units whose guest is checked in right now.
 *  - Booked tonight: units covered by a confirmed or checked-in stay tonight,
 *    so it also counts guests who haven't arrived yet.
 * Both are shown against units that are actually sellable (not out of
 * service), counting each unit once even if several bookings touch it.
 * Returns null when the store has no units, so the page can hide the cards.
 */
export async function getOccupancyStats(slug: string): Promise<OccupancyStats | null> {
  const access = await assertStorePermission(slug, "products");
  if (!access.success) return null;
  const storeId = access.store.id;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const [totalUnits, inHouseRows, tonightRows, arrivalsToday, departuresToday] = await Promise.all([
    prisma.serviceUnit.count({ where: { storeId, status: { not: "OUT_OF_SERVICE" } } }),
    prisma.booking.findMany({
      where: { storeId, status: "CHECKED_IN", unitId: { not: null } },
      select: { unitId: true },
    }),
    prisma.booking.findMany({
      where: {
        storeId,
        unitId: { not: null },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: now },
        checkOut: { gt: now },
      },
      select: { unitId: true },
    }),
    prisma.booking.count({ where: { storeId, status: { in: ["CONFIRMED", "PENDING"] }, checkIn: { gte: startOfDay, lt: endOfDay } } }),
    prisma.booking.count({ where: { storeId, status: "CHECKED_IN", checkOut: { gte: startOfDay, lt: endOfDay } } }),
  ]);

  if (totalUnits === 0) return null;

  const inHouse = new Set(inHouseRows.map((r) => r.unitId)).size;
  // A checked-in guest whose stay has run past checkout is still in the room.
  const tonight = new Set([...tonightRows, ...inHouseRows].map((r) => r.unitId)).size;

  return {
    totalUnits,
    inHouse,
    inHousePct: pct(inHouse, totalUnits),
    bookedTonight: tonight,
    bookedTonightPct: pct(tonight, totalUnits),
    arrivalsToday,
    departuresToday,
  };
}
