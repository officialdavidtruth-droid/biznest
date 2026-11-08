import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeFetch, SafeFetchError } from "@/lib/security/safe-fetch";
import { buildIcs, looksLikeIcs, parseIcs, type ExportRange } from "@/lib/channels/ical";
import { onlineHoldCutoff } from "@/lib/stay-availability";

/** Reservation statuses that occupy a room (same set createReservation checks). */
export const ACTIVE_RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export type SyncResult = { ok: boolean; blocks: number; conflicts: number; error?: string };

function describeError(err: unknown): string {
  if (err instanceof SafeFetchError) return err.message;
  if (err instanceof Error) return err.message.slice(0, 300);
  return "Unknown error";
}

type BusyClient = Pick<Prisma.TransactionClient, "propertyReservation" | "channelBlock" | "booking" | "propertyRoom">;
export type RoomBusy = { id: string; start: Date; end: Date; source: "direct" | "online" | "other_channel" };

/**
 * Everything that makes a room unsellable on a channel: front-desk reservations, online/storefront
 * bookings of the linked unit, and sales on OTHER channels. `excludeConnectionId` leaves out that
 * channel's own blocks (it must never be told about its own bookings or they could never be released).
 */
export async function collectRoomBusy(client: BusyClient, roomId: string, excludeConnectionId?: string): Promise<RoomBusy[]> {
  const horizon = new Date(Date.now() - 2 * 86_400_000);
  const room = await client.propertyRoom.findUnique({ where: { id: roomId }, select: { serviceUnitId: true } });
  const [reservations, otherBlocks, online] = await Promise.all([
    client.propertyReservation.findMany({
      where: { roomId, bookingId: null, status: { in: [...ACTIVE_RESERVATION_STATUSES] }, checkOut: { gt: horizon } },
      select: { id: true, checkIn: true, checkOut: true },
      take: 2000,
    }),
    client.channelBlock.findMany({
      where: { roomId, ...(excludeConnectionId ? { connectionId: { not: excludeConnectionId } } : {}), endDate: { gt: horizon }, connection: { isActive: true } },
      select: { id: true, startDate: true, endDate: true },
      take: 2000,
    }),
    room?.serviceUnitId
      ? client.booking.findMany({
          where: {
            unitId: room.serviceUnitId,
            checkIn: { not: null }, checkOut: { gt: horizon },
            AND: [{ status: { not: "CANCELLED" } }, { status: { not: "NO_SHOW" } }, { OR: [{ status: { not: "PENDING" } }, { createdAt: { gte: onlineHoldCutoff() } }] }],
          },
          select: { id: true, checkIn: true, checkOut: true },
          take: 2000,
        })
      : Promise.resolve([] as Array<{ id: string; checkIn: Date | null; checkOut: Date | null }>),
  ]);
  return [
    ...reservations.map((r) => ({ id: r.id, start: r.checkIn, end: r.checkOut, source: "direct" as const })),
    ...online.filter((b) => b.checkIn && b.checkOut).map((b) => ({ id: b.id, start: b.checkIn as Date, end: b.checkOut as Date, source: "online" as const })),
    ...otherBlocks.map((b) => ({ id: b.id, start: b.startDate, end: b.endDate, source: "other_channel" as const })),
  ];
}

/** Our own stays (front desk + online) in [now-1d, ...) that a channel booking would collide with. */
export async function ownStays(client: BusyClient, roomId: string): Promise<Array<{ start: Date; end: Date }>> {
  const all = await collectRoomBusy(client, roomId);
  return all.filter((b) => b.source !== "other_channel").map((b) => ({ start: b.start, end: b.end }));
}

/**
 * Tell the owner about channel bookings that overlap one of their own stays, and tell the other
 * channels the dates changed. Only called for events that are NEW, so a standing overlap doesn't nag.
 */
export async function afterBlocksChanged(conn: { id: string; storeId: string; roomId: string; provider: string; label: string | null }, info: { changed: boolean; newConflicts: number }) {
  const { notifyRoomChanged, alertChannelOwner } = await import("@/lib/channels/push");
  if (info.newConflicts > 0) {
    const room = await prisma.propertyRoom.findUnique({ where: { id: conn.roomId }, select: { name: true } });
    await alertChannelOwner(
      conn.storeId,
      "Channel booking overlaps a stay",
      `${info.newConflicts} ${conn.label || conn.provider.replace(/_/g, " ")} booking(s) overlap your own reservations for ${room?.name ?? "a room"}. Resolve them in Reservations.`,
    ).catch(() => undefined);
  }
  if (info.changed) await notifyRoomChanged(conn.roomId, { exceptConnectionId: conn.id });
}

/**
 * Pull one OTA's calendar and replace this connection's blocks with it.
 * Never throws: every outcome is recorded on the connection so the owner can
 * see exactly when it last worked and why it stopped.
 */
export async function syncConnection(connectionId: string): Promise<SyncResult> {
  const conn = await prisma.channelConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { ok: false, blocks: 0, conflicts: 0, error: "Connection not found." };
  if (!conn.importUrl) {
    return { ok: true, blocks: 0, conflicts: 0 }; // export-only link: nothing to pull
  }

  const finish = async (data: { status: "OK" | "ERROR"; message: string | null; blocks: number }) => {
    await prisma.channelConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: data.status, lastSyncMessage: data.message, lastBlockCount: data.blocks },
    });
  };

  try {
    const res = await safeFetch(conn.importUrl, {
      timeoutMs: 15_000,
      maxBytes: 1_500_000,
      headers: { accept: "text/calendar, text/plain, */*", "user-agent": "BizNest-ChannelSync/1.0" },
    });
    if (!res.ok) {
      const error = `The channel returned HTTP ${res.status}. Check the calendar link.`;
      await finish({ status: "ERROR", message: error, blocks: conn.lastBlockCount });
      return { ok: false, blocks: 0, conflicts: 0, error };
    }
    if (!looksLikeIcs(res.text)) {
      const error = "That link did not return an iCal calendar. Paste the calendar (.ics) export link from the channel.";
      await finish({ status: "ERROR", message: error, blocks: conn.lastBlockCount });
      return { ok: false, blocks: 0, conflicts: 0, error };
    }

    const events = parseIcs(res.text);
    // A truncated download would silently drop later bookings -> double-bookings. Refuse it.
    if (res.truncated) {
      const error = "The calendar was too large to read completely. Contact support.";
      await finish({ status: "ERROR", message: error, blocks: conn.lastBlockCount });
      return { ok: false, blocks: 0, conflicts: 0, error };
    }

    // De-dupe by UID (feeds occasionally repeat an event).
    const byUid = new Map(events.map((e) => [e.uid, e]));
    const unique = [...byUid.values()];

    const before = await prisma.channelBlock.findMany({ where: { connectionId: conn.id, uid: { not: { startsWith: "hook:" } } }, select: { uid: true, startDate: true, endDate: true } });
    const beforeKey = new Map(before.map((b) => [b.uid, `${b.startDate.toISOString()}|${b.endDate.toISOString()}`]));

    await prisma.$transaction([
      // Blocks pushed in through the live webhook (uid "hook:...") are not in the calendar and must survive.
      prisma.channelBlock.deleteMany({ where: { connectionId: conn.id, uid: { not: { startsWith: "hook:" } } } }),
      prisma.channelBlock.createMany({
        data: unique.map((e) => ({
          storeId: conn.storeId,
          roomId: conn.roomId,
          connectionId: conn.id,
          uid: e.uid,
          startDate: e.start,
          endDate: e.end,
          summary: e.summary,
        })),
        skipDuplicates: true,
      }),
    ]);

    // Surface (never auto-cancel) any own stay (front desk or online) the OTA's booking now overlaps.
    const active = await ownStays(prisma, conn.roomId);
    const overlapping = unique.filter((e) => active.some((r) => r.start < e.end && r.end > e.start));
    const conflicts = overlapping.length;
    const keyOf = (e: { start: Date; end: Date }) => `${e.start.toISOString()}|${e.end.toISOString()}`;
    const newConflicts = overlapping.filter((e) => beforeKey.get(e.uid) !== keyOf(e)).length;
    const changed = unique.length !== before.length || unique.some((e) => beforeKey.get(e.uid) !== keyOf(e));

    await finish({
      status: "OK",
      message: conflicts > 0 ? `${conflicts} overlap(s) with your own reservations. Resolve them in Reservations.` : null,
      blocks: unique.length,
    });
    if (changed || newConflicts > 0) await afterBlocksChanged(conn, { changed, newConflicts }).catch(() => undefined);
    return { ok: true, blocks: unique.length, conflicts };
  } catch (err) {
    const error = describeError(err);
    await finish({ status: "ERROR", message: error, blocks: conn.lastBlockCount }).catch(() => undefined);
    return { ok: false, blocks: 0, conflicts: 0, error };
  }
}

/**
 * The .ics feed an OTA imports for one connection: our direct reservations
 * plus blocks that came from OTHER channels for the same room. This
 * connection's own blocks are excluded on purpose, otherwise the OTA would be
 * re-importing its own bookings and they could never be released.
 */
export async function buildExportFeedForToken(token: string): Promise<string | null> {
  const conn = await prisma.channelConnection.findUnique({
    where: { exportToken: token },
    include: { room: { select: { name: true } }, store: { select: { name: true, timezone: true } } },
  });
  if (!conn || !conn.isActive) return null;

  const busy = await collectRoomBusy(prisma, conn.roomId, conn.id);
  const prefix = { direct: "res", online: "bkg", other_channel: "blk" } as const;
  const ranges: ExportRange[] = busy.map((b) => ({
    uid: `${prefix[b.source]}-${b.id}@biznest.space`,
    checkIn: b.start,
    checkOut: b.end,
    summary: b.source === "other_channel" ? "Unavailable" : "Reserved",
  }));

  return buildIcs({ calendarName: `${conn.store.name} - ${conn.room.name}`, ranges, timeZone: conn.store.timezone || "Africa/Lagos" });
}

/** Does any OTA block overlap [checkIn, checkOut) for this room? Used by createReservation. */
export async function findChannelBlockOverlap(
  tx: Prisma.TransactionClient,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
) {
  return tx.channelBlock.findFirst({
    where: { roomId, startDate: { lt: checkOut }, endDate: { gt: checkIn }, connection: { isActive: true } },
    include: { connection: { select: { provider: true } } },
  });
}
