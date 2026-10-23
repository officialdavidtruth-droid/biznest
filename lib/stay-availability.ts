import type { Prisma } from "@prisma/client";

/**
 * One definition of "is this room taken?" for unit-based stays (hotel rooms).
 *
 * A room can be taken in three places: an online/staff Booking on its
 * ServiceUnit, a front-desk PropertyReservation in the PMS, or an OTA
 * ChannelBlock (Booking.com, Airbnb...). The last two live on PropertyRoom,
 * which is linked to its ServiceUnit by PropertyRoom.serviceUnitId. Every
 * availability check and every write goes through here, so the PMS and the
 * online storefront can never disagree about whether a room is free.
 */

/** Same hold window as lib/actions/booking.ts: unpaid online bookings hold a room this long. */
export const ONLINE_BOOKING_HOLD_MINUTES = 30;
export const onlineHoldCutoff = () => new Date(Date.now() - ONLINE_BOOKING_HOLD_MINUTES * 60 * 1000);

/** Reservation statuses that occupy a room (mirrors ACTIVE_RESERVATION_STATUSES in lib/channels/sync.ts). */
export const ACTIVE_PMS_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export type BusyInterval = { unitId: string; checkIn: Date; checkOut: Date; source: "booking" | "pms" | "channel" };

type Client = Pick<Prisma.TransactionClient, "booking" | "propertyReservation" | "channelBlock" | "propertyRoom">;

const liveBookingWhere = () => ({
  AND: [
    { status: { not: "CANCELLED" as const } },
    { OR: [{ status: { not: "PENDING" as const } }, { createdAt: { gte: onlineHoldCutoff() } }] },
  ],
});

/**
 * Every interval in [from, to) during which a unit of this service is taken,
 * from all three sources. Unlinked PMS rooms can't be attributed to a unit
 * and are not included.
 */
export async function getBusyIntervals(client: Client, serviceId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const [bookings, linkedRooms] = await Promise.all([
    client.booking.findMany({
      where: { serviceId, ...liveBookingWhere(), checkIn: { lt: to }, checkOut: { gt: from } },
      select: { unitId: true, checkIn: true, checkOut: true },
    }),
    client.propertyRoom.findMany({
      where: { serviceUnit: { serviceId } },
      select: { id: true, serviceUnitId: true },
    }),
  ]);

  const out: BusyInterval[] = [];
  for (const b of bookings) {
    if (b.unitId && b.checkIn && b.checkOut) out.push({ unitId: b.unitId, checkIn: b.checkIn, checkOut: b.checkOut, source: "booking" });
  }
  if (linkedRooms.length === 0) return out;

  const unitByRoom = new Map(linkedRooms.filter((r) => r.serviceUnitId).map((r) => [r.id, r.serviceUnitId as string]));
  const roomIds = [...unitByRoom.keys()];
  const [reservations, blocks] = await Promise.all([
    client.propertyReservation.findMany({
      where: { roomId: { in: roomIds }, status: { in: [...ACTIVE_PMS_STATUSES] }, checkIn: { lt: to }, checkOut: { gt: from } },
      select: { roomId: true, checkIn: true, checkOut: true },
    }),
    client.channelBlock.findMany({
      where: { roomId: { in: roomIds }, startDate: { lt: to }, endDate: { gt: from }, connection: { isActive: true } },
      select: { roomId: true, startDate: true, endDate: true },
    }),
  ]);
  for (const r of reservations) out.push({ unitId: unitByRoom.get(r.roomId)!, checkIn: r.checkIn, checkOut: r.checkOut, source: "pms" });
  for (const b of blocks) out.push({ unitId: unitByRoom.get(b.roomId)!, checkIn: b.startDate, checkOut: b.endDate, source: "channel" });
  return out;
}

/** Units taken at any point in [checkIn, checkOut). Half-open: a stay ending the day another starts does not clash. */
export function busyUnitIds(intervals: BusyInterval[], checkIn: Date, checkOut: Date): Set<string> {
  const ids = new Set<string>();
  for (const i of intervals) if (i.checkIn < checkOut && i.checkOut > checkIn) ids.add(i.unitId);
  return ids;
}

/**
 * For the PMS side: is the online unit linked to this room taken by an online
 * or staff Booking during [checkIn, checkOut)? Returns the clashing booking or null.
 */
export async function findBookingOverlapForUnit(client: Pick<Prisma.TransactionClient, "booking">, unitId: string, checkIn: Date, checkOut: Date) {
  return client.booking.findFirst({
    where: { unitId, ...liveBookingWhere(), checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
    select: { id: true, source: true },
  });
}

/**
 * For the staff calendar: is the PMS room linked to this unit reserved (or
 * blocked by an OTA) during [checkIn, checkOut)? Returns a short reason or null.
 */
export async function findPmsConflictForUnit(
  client: Pick<Prisma.TransactionClient, "propertyRoom" | "propertyReservation" | "channelBlock">,
  unitId: string,
  checkIn: Date,
  checkOut: Date
): Promise<string | null> {
  const room = await client.propertyRoom.findFirst({ where: { serviceUnitId: unitId }, select: { id: true } });
  if (!room) return null;
  const [reservation, block] = await Promise.all([
    client.propertyReservation.findFirst({
      where: { roomId: room.id, status: { in: [...ACTIVE_PMS_STATUSES] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
      select: { id: true },
    }),
    client.channelBlock.findFirst({
      where: { roomId: room.id, startDate: { lt: checkOut }, endDate: { gt: checkIn }, connection: { isActive: true } },
      select: { id: true },
    }),
  ]);
  if (reservation) return "reserved at the front desk";
  if (block) return "booked on a connected channel";
  return null;
}
