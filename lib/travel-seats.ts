import type { Prisma } from "@prisma/client";
import { SEAT_HOLDING_STATUSES } from "@/lib/travel";
import { departureCapacity } from "@/lib/travel-growth";

type Db = Prisma.TransactionClient;

/**
 * Seats on a package are counted per departure. A trip with no departure belongs to the package's own (main) date;
 * a trip on an extra departure counts only against that departure, so selling out 20 June leaves 4 July open.
 * Only committed trips hold seats (see SEAT_HOLDING_STATUSES); enquiries and quotes never block a tour.
 */
export async function seatsHeld(db: Db, packageId: string, departureId: string | null, excludeTripId?: string): Promise<number> {
  return db.travelTraveler.count({
    where: { trip: { packageId, departureId, status: { in: [...SEAT_HOLDING_STATUSES] }, ...(excludeTripId ? { id: { not: excludeTripId } } : {}) } },
  });
}

/** Seat limit (0 = unlimited) and label for the pool a trip draws from. Null when the package or departure is gone. */
export async function seatCapacity(db: Db, packageId: string, departureId: string | null): Promise<{ capacity: number; label: string } | null> {
  const pkg = await db.travelPackage.findUnique({ where: { id: packageId }, select: { seats: true, name: true } });
  if (!pkg) return null;
  if (!departureId) return { capacity: Math.max(0, pkg.seats), label: pkg.name };
  const dep = await db.travelDeparture.findUnique({ where: { id: departureId }, select: { seats: true, departureDate: true, packageId: true } });
  if (!dep || dep.packageId !== packageId) return null;
  const date = dep.departureDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return { capacity: departureCapacity({ departureSeats: dep.seats, packageSeats: pkg.seats }), label: `${pkg.name} (${date})` };
}
