/**
 * Apply a verified inbound webhook (a channel manager telling us a booking was made, changed or
 * cancelled on a channel). Blocks are stored with a "hook:" uid prefix so a later calendar pull for
 * the same connection never wipes them.
 */
import { prisma } from "@/lib/prisma";
import type { InboundEvent } from "@/lib/channels/live";
import { afterBlocksChanged, ownStays } from "@/lib/channels/sync";

export type InboundConnection = { id: string; storeId: string; roomId: string; provider: string; label: string | null };

export async function applyInboundEvents(conn: InboundConnection, events: InboundEvent[]): Promise<{ applied: number; conflicts: number }> {
  const uids = events.map((e) => `hook:${e.uid}`);
  const existing = await prisma.channelBlock.findMany({
    where: { connectionId: conn.id, uid: { in: uids } },
    select: { uid: true, startDate: true, endDate: true },
  });
  const known = new Map(existing.map((b) => [b.uid, `${b.startDate.toISOString()}|${b.endDate.toISOString()}`]));
  const stays = await ownStays(prisma, conn.roomId);

  // The last event for a uid wins.
  const finalByUid = new Map<string, InboundEvent>();
  for (const e of events) finalByUid.set(e.uid, e);

  let changed = false;
  let newConflicts = 0;
  for (const e of finalByUid.values()) {
    const uid = `hook:${e.uid}`;
    if (e.type === "booking.cancelled") {
      const res = await prisma.channelBlock.deleteMany({ where: { connectionId: conn.id, uid } });
      if (res.count > 0) changed = true;
      continue;
    }
    const key = `${e.start.toISOString()}|${e.end.toISOString()}`;
    if (known.get(uid) === key) continue; // replayed, nothing new
    await prisma.channelBlock.upsert({
      where: { connectionId_uid: { connectionId: conn.id, uid } },
      create: { storeId: conn.storeId, roomId: conn.roomId, connectionId: conn.id, uid, startDate: e.start, endDate: e.end, summary: e.summary },
      update: { startDate: e.start, endDate: e.end, summary: e.summary },
    });
    changed = true;
    if (stays.some((s) => s.start < e.end && s.end > e.start)) newConflicts++;
  }

  const total = await prisma.channelBlock.count({ where: { connectionId: conn.id } });
  await prisma.channelConnection.update({
    where: { id: conn.id },
    data: { lastHookAt: new Date(), lastSyncAt: new Date(), lastSyncStatus: "OK", lastSyncMessage: newConflicts > 0 ? `${newConflicts} overlap(s) with your own reservations. Resolve them in Reservations.` : null, lastBlockCount: total },
  });
  if (changed || newConflicts > 0) await afterBlocksChanged(conn, { changed, newConflicts }).catch(() => undefined);
  return { applied: finalByUid.size, conflicts: newConflicts };
}
