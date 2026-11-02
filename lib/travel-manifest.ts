import { prisma } from "@/lib/prisma";
import { SEAT_HOLDING_STATUSES, type ManifestRow } from "@/lib/travel";

/**
 * Travellers on a group departure: every traveller of a seat-holding trip (confirmed or later) on the package.
 * storeId is in the where clause, so a package id from another store returns null.
 */
export async function loadDeparture(storeId: string, packageId: string) {
  const pkg = await prisma.travelPackage.findFirst({
    where: { id: packageId, storeId },
    select: { id: true, name: true, destination: true, departureDate: true, durationDays: true, seats: true },
  });
  if (!pkg) return null;
  const trips = await prisma.travelTrip.findMany({
    where: { storeId, packageId, status: { in: [...SEAT_HOLDING_STATUSES] } },
    orderBy: { reference: "asc" },
    select: {
      id: true, reference: true, status: true,
      client: { select: { fullName: true, phone: true } },
      travellers: { orderBy: [{ isLead: "desc" }, { fullName: "asc" }] },
    },
  });
  const rows: ManifestRow[] = trips.flatMap((t) => t.travellers.map((x) => ({
    travelerId: x.id, tripId: t.id, tripReference: t.reference, tripStatus: t.status, fullName: x.fullName, isLead: x.isLead,
    gender: x.gender, passportNo: x.passportNo, passportExpiry: x.passportExpiry?.toISOString() ?? null,
    dateOfBirth: x.dateOfBirth?.toISOString() ?? null, nationality: x.nationality,
    roomType: x.roomType, roomLabel: x.roomLabel, requests: x.requests,
    contactName: t.client.fullName, contactPhone: t.client.phone,
  })));
  return { pkg: { ...pkg, departureDate: pkg.departureDate?.toISOString() ?? null }, rows };
}
