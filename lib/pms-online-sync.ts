import { prisma } from "@/lib/prisma";
import { onlineHoldCutoff } from "@/lib/stay-availability";

type ResStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

function mapStatus(status: string, createdAt: Date): ResStatus {
  switch (status) {
    case "CONFIRMED": return "CONFIRMED";
    case "CHECKED_IN": case "SEATED": return "CHECKED_IN";
    case "COMPLETED": return "CHECKED_OUT";
    case "CANCELLED": return "CANCELLED";
    case "NO_SHOW": return "NO_SHOW";
    default: return createdAt >= onlineHoldCutoff() ? "PENDING" : "CANCELLED"; // an unpaid online hold that expired
  }
}

/**
 * The PMS keeps its own rooms, guests and reservations, while the storefront and the main
 * dashboard use online room units and bookings. This brings the online side into the PMS so the
 * front desk sees one picture:
 *   1. every online room unit without a PMS room gets one (linked, so availability stays shared);
 *   2. every online stay booking becomes a PMS reservation (and guest), kept in step with the booking.
 * Mirrored reservations carry `bookingId`; availability checks ignore them because the booking
 * itself already blocks the room. Safe to run on every PMS load.
 */
export async function syncOnlineStaysIntoPms(storeId: string): Promise<void> {
  // ---- 1. rooms
  const [units, rooms] = await Promise.all([
    prisma.serviceUnit.findMany({ where: { storeId }, select: { id: true, label: true, service: { select: { name: true } } } }),
    prisma.propertyRoom.findMany({ where: { storeId }, select: { id: true, name: true, serviceUnitId: true } }),
  ]);
  const linked = new Set(rooms.map((r) => r.serviceUnitId).filter(Boolean) as string[]);
  const names = new Set(rooms.map((r) => r.name.trim().toLowerCase()));
  for (const u of units) {
    if (linked.has(u.id)) continue;
    // Prefer linking an existing, unlinked room with the same name.
    const same = rooms.find((r) => !r.serviceUnitId && r.name.trim().toLowerCase() === u.label.trim().toLowerCase());
    if (same) { await prisma.propertyRoom.update({ where: { id: same.id }, data: { serviceUnitId: u.id } }).catch(() => {}); same.serviceUnitId = u.id; continue; }
    const name = names.has(u.label.trim().toLowerCase()) ? `${u.service.name} ${u.label}` : u.label;
    try {
      const room = await prisma.propertyRoom.create({ data: { storeId, name, roomType: u.service.name, serviceUnitId: u.id } });
      rooms.push({ id: room.id, name: room.name, serviceUnitId: u.id });
      names.add(name.trim().toLowerCase());
    } catch { /* name clash or race: skip, it is retried on the next load */ }
  }
  const roomByUnit = new Map(rooms.filter((r) => r.serviceUnitId).map((r) => [r.serviceUnitId as string, r.id]));
  if (roomByUnit.size === 0) return;

  // ---- 2. bookings -> reservations
  const bookings = await prisma.booking.findMany({
    where: { storeId, unitId: { in: [...roomByUnit.keys()] }, checkIn: { not: null }, checkOut: { gte: new Date(Date.now() - 90 * 86_400_000) } },
    select: { id: true, unitId: true, checkIn: true, checkOut: true, status: true, createdAt: true, notes: true, guestName: true, guestPhone: true, buyer: { select: { name: true, email: true } } },
    orderBy: { checkIn: "asc" },
    take: 1000,
  });
  if (bookings.length === 0) return;
  const mirrors = await prisma.propertyReservation.findMany({ where: { storeId, bookingId: { in: bookings.map((b) => b.id) } }, select: { id: true, bookingId: true, status: true, roomId: true, checkIn: true, checkOut: true } });
  const mirrorOf = new Map(mirrors.map((m) => [m.bookingId as string, m]));

  const guestCache = new Map<string, string>();
  async function guestFor(b: (typeof bookings)[number]): Promise<string> {
    const fullName = (b.guestName || b.buyer?.name || "Online guest").trim().slice(0, 120);
    const phone = b.guestPhone?.trim() || null;
    const email = b.buyer?.email?.trim().toLowerCase() || null;
    const key = `${phone ?? ""}|${email ?? ""}|${fullName.toLowerCase()}`;
    const hit = guestCache.get(key);
    if (hit) return hit;
    const existing = await prisma.propertyGuest.findFirst({
      where: { storeId, OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : []), { fullName: { equals: fullName, mode: "insensitive" as const } }] },
      select: { id: true },
    });
    const id = existing?.id ?? (await prisma.propertyGuest.create({ data: { storeId, fullName, phone, email, notes: "Booked online" } })).id;
    guestCache.set(key, id);
    return id;
  }

  for (const b of bookings) {
    if (!b.unitId || !b.checkIn || !b.checkOut) continue;
    const roomId = roomByUnit.get(b.unitId);
    if (!roomId) continue;
    const want = mapStatus(b.status, b.createdAt);
    const m = mirrorOf.get(b.id);
    try {
      if (!m) {
        if (want === "CANCELLED") continue; // nothing to show for a booking that never took hold
        await prisma.propertyReservation.create({
          data: { storeId, bookingId: b.id, guestId: await guestFor(b), roomId, checkIn: b.checkIn, checkOut: b.checkOut, status: want, notes: ["Online booking", b.notes].filter(Boolean).join(" · ").slice(0, 500) },
        });
        continue;
      }
      // Keep in step while the reservation is still open. Never undo what the front desk already did.
      const frontDeskOwns = m.status !== "PENDING" && m.status !== "CONFIRMED"; // checked in/out, cancelled or no-show at the desk
      const data: { status?: ResStatus; checkIn?: Date; checkOut?: Date; cancelledAt?: Date } = {};
      if ((want === "CANCELLED" || want === "NO_SHOW") && m.status !== want && !frontDeskOwns) { data.status = want; if (want === "CANCELLED") data.cancelledAt = new Date(); }
      else if (!frontDeskOwns && m.status !== want && want !== "CANCELLED" && want !== "NO_SHOW") data.status = want;
      if (!frontDeskOwns && (m.checkIn.getTime() !== b.checkIn.getTime() || m.checkOut.getTime() !== b.checkOut.getTime())) { data.checkIn = b.checkIn; data.checkOut = b.checkOut; }
      if (Object.keys(data).length) await prisma.propertyReservation.update({ where: { id: m.id }, data });
    } catch { /* one bad row must never block the workspace */ }
  }
}
