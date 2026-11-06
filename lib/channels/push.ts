/**
 * Live availability push + freshness for the channel link.
 *
 *  - notifyRoomChanged / notifyUnitChanged: call after anything that changes which
 *    dates a room can be sold on. Writes a snapshot to the outbox for every active
 *    connection with a push URL and delivers it right after the response.
 *  - deliverPush / flushDuePushes: signed POST with back-off retries (cron picks up leftovers).
 *  - refreshRoomChannels: pull any OTA calendar older than a few minutes before a booking is accepted.
 *
 * None of this ever throws into a booking: failures are recorded on the connection for the owner.
 */
import { prisma } from "@/lib/prisma";
import { safeFetch, SafeFetchError } from "@/lib/security/safe-fetch";
import { logError, errorMeta } from "@/lib/observability/log";
import { notifyUser } from "@/lib/notifications/notify";
import { buildPushPayload, FRESH_MAX_AGE_MS, MAX_PUSH_ATTEMPTS, retryDelayMs, signBody, toBusyRanges, type PushPayload } from "@/lib/channels/live";
import { collectRoomBusy, syncConnection } from "@/lib/channels/sync";

const DELIVERY_TIMEOUT_MS = 8_000;
const LEASE_MS = 2 * 60_000;

function describe(err: unknown): string {
  if (err instanceof SafeFetchError) return err.message;
  if (err instanceof Error) return err.message.slice(0, 200);
  return "Unknown error";
}

export type EnqueueOptions = { event?: PushPayload["event"]; exceptConnectionId?: string };

/** Write a fresh snapshot for one connection, replacing any still-pending one. Returns the push id. */
export async function enqueueConnectionPush(connectionId: string, event: PushPayload["event"] = "availability.updated"): Promise<string | null> {
  const conn = await prisma.channelConnection.findUnique({
    where: { id: connectionId },
    include: { room: { select: { id: true, name: true } }, store: { select: { name: true } } },
  });
  if (!conn || !conn.isActive || !conn.pushUrl || !conn.liveSecret) return null;

  const busy = toBusyRanges(await collectRoomBusy(prisma, conn.roomId, conn.id));
  const { pushSeq } = await prisma.channelConnection.update({ where: { id: conn.id }, data: { pushSeq: { increment: 1 } }, select: { pushSeq: true } });
  const payload = buildPushPayload({
    event, seq: pushSeq, property: conn.store.name, room: conn.room,
    channel: { id: conn.id, provider: conn.provider }, busy,
  });
  const [, created] = await prisma.$transaction([
    prisma.channelPush.deleteMany({ where: { connectionId: conn.id, status: "PENDING" } }),
    prisma.channelPush.create({ data: { storeId: conn.storeId, connectionId: conn.id, seq: pushSeq, payload: JSON.stringify(payload) } }),
  ]);
  return created.id;
}

export async function enqueueRoomPush(roomId: string, opts: EnqueueOptions = {}): Promise<string[]> {
  const conns = await prisma.channelConnection.findMany({
    where: { roomId, isActive: true, pushUrl: { not: null }, liveSecret: { not: null }, ...(opts.exceptConnectionId ? { id: { not: opts.exceptConnectionId } } : {}) },
    select: { id: true },
  });
  const ids: string[] = [];
  for (const c of conns) {
    const id = await enqueueConnectionPush(c.id, opts.event);
    if (id) ids.push(id);
  }
  return ids;
}

async function deliverMany(ids: string[]) {
  for (const id of ids) await deliverPush(id).catch((err) => void logError("JOBS", "Channel push crashed", errorMeta(err, { pushId: id })));
}

/** Run delivery after the response when we're inside a request, otherwise inline. */
async function schedule(ids: string[]) {
  if (ids.length === 0) return;
  try {
    const { after } = await import("next/server");
    after(() => deliverMany(ids));
  } catch {
    await deliverMany(ids);
  }
}

/** Availability of this room changed: tell every live channel. Never throws. */
export async function notifyRoomChanged(roomId: string, opts: EnqueueOptions = {}): Promise<void> {
  try {
    await schedule(await enqueueRoomPush(roomId, opts));
  } catch (err) {
    void logError("JOBS", "Could not queue channel push", errorMeta(err, { roomId }));
  }
}

/** A bookable unit changed: find the PMS rooms linked to it and notify them. Never throws. */
export async function notifyUnitChanged(unitId: string | null | undefined): Promise<void> {
  if (!unitId) return;
  try {
    const rooms = await prisma.propertyRoom.findMany({ where: { serviceUnitId: unitId }, select: { id: true } });
    for (const r of rooms) await notifyRoomChanged(r.id);
  } catch (err) {
    void logError("JOBS", "Could not queue channel push for unit", errorMeta(err, { unitId }));
  }
}

async function alertOwner(storeId: string, title: string, body: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { slug: true, business: { select: { user: { select: { id: true } } } } } });
  const ownerId = store?.business?.user?.id;
  if (ownerId && store) await notifyUser({ userId: ownerId, type: "CHANNEL_SYNC", title, body, url: `/store/${store.slug}/admin/pms` }).catch(() => undefined);
}

/** One signed POST. Returns true when the receiver accepted it (2xx). */
export async function deliverPush(pushId: string, now: Date = new Date()): Promise<boolean> {
  // Lease the row so the post-response delivery and the cron can't both send it.
  const claimed = await prisma.channelPush.updateMany({
    where: { id: pushId, status: "PENDING", nextAttemptAt: { lte: now } },
    data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
  });
  if (claimed.count === 0) return false;
  const push = await prisma.channelPush.findUnique({ where: { id: pushId }, include: { connection: true } });
  if (!push) return false;
  const conn = push.connection;

  const fail = async (message: string, permanent: boolean) => {
    const attempts = push.attempts + 1;
    const dead = permanent || attempts >= MAX_PUSH_ATTEMPTS;
    await prisma.$transaction([
      prisma.channelPush.update({
        where: { id: push.id },
        data: dead ? { status: "FAILED", attempts, lastError: message } : { attempts, lastError: message, nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)) },
      }),
      prisma.channelConnection.update({
        where: { id: conn.id },
        data: { lastPushAt: now, lastPushStatus: "ERROR", lastPushMessage: dead ? `${message}. Gave up after ${attempts} attempt(s).` : `${message}. Retrying.` },
      }),
    ]);
    if (dead) await alertOwner(conn.storeId, "Channel update not delivered", `${conn.label || conn.provider.replace(/_/g, " ")}: ${message}. Check the push address in Channels & OTAs.`);
    return false;
  };

  if (!conn.isActive || !conn.pushUrl || !conn.liveSecret) return fail("Live push is switched off for this channel", true);

  const timestamp = String(Math.floor(now.getTime() / 1000));
  const event = (JSON.parse(push.payload) as PushPayload).event;
  try {
    const res = await safeFetch(conn.pushUrl, {
      method: "POST",
      body: push.payload,
      timeoutMs: DELIVERY_TIMEOUT_MS,
      maxBytes: 20_000,
      headers: {
        "content-type": "application/json",
        "user-agent": "BizNest-ChannelPush/1.0",
        "x-biznest-event": event,
        "x-biznest-delivery": push.id,
        "x-biznest-timestamp": timestamp,
        "x-biznest-signature": signBody(conn.liveSecret, timestamp, push.payload),
      },
    });
    if (!res.ok) return fail(`The receiver answered HTTP ${res.status}`, false);
  } catch (err) {
    return fail(describe(err), err instanceof SafeFetchError && err.code === "BLOCKED");
  }

  await prisma.$transaction([
    prisma.channelPush.update({ where: { id: push.id }, data: { status: "SENT", sentAt: now, attempts: push.attempts + 1, lastError: null } }),
    prisma.channelConnection.update({ where: { id: conn.id }, data: { lastPushAt: now, lastPushStatus: "OK", lastPushMessage: null } }),
  ]);
  return true;
}

/** Cron: deliver whatever is due, refresh stale snapshots, tidy old rows. */
export async function flushDuePushes(opts: { limit?: number; deadlineMs?: number } = {}) {
  const now = new Date();
  const deadline = Date.now() + (opts.deadlineMs ?? 40_000);
  const due = await prisma.channelPush.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    select: { id: true },
    take: opts.limit ?? 40,
  });
  let sent = 0, failed = 0;
  for (const p of due) {
    if (Date.now() > deadline) break;
    if (await deliverPush(p.id).catch(() => false)) sent++; else failed++;
  }

  // Self-heal: dates re-open without any event when an unpaid online hold expires, so re-send a snapshot daily.
  const staleBefore = new Date(now.getTime() - 20 * 3_600_000);
  const stale = await prisma.channelConnection.findMany({
    where: { isActive: true, pushUrl: { not: null }, liveSecret: { not: null }, OR: [{ lastPushAt: null }, { lastPushAt: { lt: staleBefore } }], pushes: { none: { status: "PENDING" } } },
    select: { id: true },
    take: 20,
  });
  const refreshed: string[] = [];
  for (const c of stale) { const id = await enqueueConnectionPush(c.id); if (id) refreshed.push(id); }
  if (Date.now() < deadline) await deliverMany(refreshed);

  await prisma.channelPush.deleteMany({ where: { OR: [{ status: "SENT", sentAt: { lt: new Date(now.getTime() - 14 * 86_400_000) } }, { status: "FAILED", createdAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } }] } });
  await prisma.channelBlock.deleteMany({ where: { uid: { startsWith: "hook:" }, endDate: { lt: new Date(now.getTime() - 7 * 86_400_000) } } });
  return { sent, failed, refreshed: refreshed.length };
}

/**
 * Pull any of this room's OTA calendars that haven't been read for a few minutes, so a booking is
 * checked against fresh data. Bounded wait; never throws; a failing channel does not block the booking.
 */
export async function refreshRoomChannels(roomIds: string | string[], maxAgeMs: number = FRESH_MAX_AGE_MS, waitMs = 6_000): Promise<{ refreshed: number }> {
  try {
    const ids = Array.isArray(roomIds) ? roomIds : [roomIds];
    if (ids.length === 0) return { refreshed: 0 };
    const stale = await prisma.channelConnection.findMany({
      where: { roomId: { in: ids }, isActive: true, importUrl: { not: null }, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - maxAgeMs) } }] },
      select: { id: true },
      take: 6,
    });
    if (stale.length === 0) return { refreshed: 0 };
    const all = Promise.allSettled(stale.map((c) => syncConnection(c.id)));
    await Promise.race([all, new Promise((r) => setTimeout(r, waitMs))]);
    return { refreshed: stale.length };
  } catch (err) {
    void logError("JOBS", "Channel refresh failed", errorMeta(err));
    return { refreshed: 0 };
  }
}

export async function refreshChannelsForService(serviceId: string): Promise<void> {
  const rooms = await prisma.propertyRoom.findMany({ where: { serviceUnit: { serviceId } }, select: { id: true } });
  await refreshRoomChannels(rooms.map((r) => r.id));
}

export { alertOwner as alertChannelOwner };
