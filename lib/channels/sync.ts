import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeFetch, SafeFetchError } from "@/lib/security/safe-fetch";
import { buildIcs, looksLikeIcs, parseIcs, type ExportRange } from "@/lib/channels/ical";

/** Reservation statuses that occupy a room (same set createReservation checks). */
export const ACTIVE_RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

export type SyncResult = { ok: boolean; blocks: number; conflicts: number; error?: string };

function describeError(err: unknown): string {
  if (err instanceof SafeFetchError) return err.message;
  if (err instanceof Error) return err.message.slice(0, 300);
  return "Unknown error";
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

    await prisma.$transaction([
      prisma.channelBlock.deleteMany({ where: { connectionId: conn.id } }),
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

    // Surface (never auto-cancel) any direct reservation the OTA's booking now overlaps.
    const active = await prisma.propertyReservation.findMany({
      where: { roomId: conn.roomId, status: { in: [...ACTIVE_RESERVATION_STATUSES] }, checkOut: { gt: new Date() } },
      select: { checkIn: true, checkOut: true },
    });
    const conflicts = unique.filter((e) => active.some((r) => r.checkIn < e.end && r.checkOut > e.start)).length;

    await finish({
      status: "OK",
      message: conflicts > 0 ? `${conflicts} overlap(s) with your own reservations. Resolve them in Reservations.` : null,
      blocks: unique.length,
    });
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

  const horizon = new Date(Date.now() - 2 * 86_400_000);
  const [reservations, otherBlocks] = await Promise.all([
    prisma.propertyReservation.findMany({
      where: { roomId: conn.roomId, status: { in: [...ACTIVE_RESERVATION_STATUSES] }, checkOut: { gt: horizon } },
      select: { id: true, checkIn: true, checkOut: true },
      take: 2000,
    }),
    prisma.channelBlock.findMany({
      where: { roomId: conn.roomId, connectionId: { not: conn.id }, endDate: { gt: horizon }, connection: { isActive: true } },
      select: { id: true, startDate: true, endDate: true },
      take: 2000,
    }),
  ]);

  const ranges: ExportRange[] = [
    ...reservations.map((r) => ({ uid: `res-${r.id}@biznest.space`, checkIn: r.checkIn, checkOut: r.checkOut, summary: "Reserved" })),
    ...otherBlocks.map((b) => ({ uid: `blk-${b.id}@biznest.space`, checkIn: b.startDate, checkOut: b.endDate, summary: "Unavailable" })),
  ];

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
