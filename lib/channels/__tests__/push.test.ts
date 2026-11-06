import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    channelConnection: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    channelPush: { create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    channelBlock: { deleteMany: vi.fn() },
    store: { findUnique: vi.fn() },
    propertyRoom: { findMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
  safeFetch: vi.fn(),
  collectRoomBusy: vi.fn(),
  syncConnection: vi.fn(),
  notifyUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/security/safe-fetch", () => {
  class SafeFetchError extends Error { code: string; constructor(msg: string, code: string) { super(msg); this.code = code; } }
  return { safeFetch: m.safeFetch, SafeFetchError };
});
vi.mock("@/lib/channels/sync", () => ({ collectRoomBusy: m.collectRoomBusy, syncConnection: m.syncConnection }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: m.notifyUser }));
vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), errorMeta: () => ({}) }));

import { deliverPush, enqueueConnectionPush, refreshRoomChannels } from "@/lib/channels/push";
import { SafeFetchError } from "@/lib/security/safe-fetch";
import { verifySignature } from "@/lib/channels/live";

const NOW = new Date("2026-12-01T10:00:00Z");
const conn = { id: "c1", storeId: "s1", roomId: "r1", provider: "BOOKING_COM", label: null, isActive: true, pushUrl: "https://hooks.example.com/x", liveSecret: "sek", room: { id: "r1", name: "Deluxe 1" }, store: { name: "Test Hotel" } };
const payload = JSON.stringify({ event: "availability.updated", seq: 3, busy: [] });

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  m.prisma.channelPush.updateMany.mockResolvedValue({ count: 1 });
  m.prisma.channelPush.findUnique.mockResolvedValue({ id: "p1", attempts: 0, payload, connection: conn });
  m.notifyUser.mockResolvedValue(undefined);
  m.prisma.store.findUnique.mockResolvedValue({ slug: "test-hotel", business: { user: { id: "u1" } } });
});

describe("enqueueConnectionPush", () => {
  it("skips connections without a push address or secret", async () => {
    m.prisma.channelConnection.findUnique.mockResolvedValue({ ...conn, pushUrl: null });
    expect(await enqueueConnectionPush("c1")).toBeNull();
    expect(m.prisma.channelPush.create).not.toHaveBeenCalled();
  });
  it("replaces the pending snapshot with a fresh numbered one that leaves out this channel's own blocks", async () => {
    m.prisma.channelConnection.findUnique.mockResolvedValue(conn);
    m.prisma.channelConnection.update.mockResolvedValue({ pushSeq: 7 });
    m.collectRoomBusy.mockResolvedValue([{ id: "a", start: new Date("2026-12-20T00:00:00Z"), end: new Date("2026-12-23T00:00:00Z"), source: "direct" }]);
    m.prisma.channelPush.create.mockResolvedValue({ id: "p9" });
    expect(await enqueueConnectionPush("c1")).toBe("p9");
    expect(m.collectRoomBusy).toHaveBeenCalledWith(m.prisma, "r1", "c1");
    expect(m.prisma.channelPush.deleteMany).toHaveBeenCalledWith({ where: { connectionId: "c1", status: "PENDING" } });
    const data = m.prisma.channelPush.create.mock.calls[0][0].data;
    expect(data.seq).toBe(7);
    expect(JSON.parse(data.payload)).toMatchObject({ event: "availability.updated", seq: 7, room: { name: "Deluxe 1" }, busy: [{ start: "2026-12-20", end: "2026-12-23", source: "direct" }] });
  });
});

describe("deliverPush", () => {
  it("posts a signed body and marks it sent", async () => {
    m.safeFetch.mockResolvedValue({ ok: true, status: 200 });
    expect(await deliverPush("p1", NOW)).toBe(true);
    const [url, opts] = m.safeFetch.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/x");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(payload);
    expect(verifySignature({ secret: "sek", timestamp: opts.headers["x-biznest-timestamp"], signature: opts.headers["x-biznest-signature"], rawBody: payload, nowMs: NOW.getTime() })).toBe(true);
    expect(opts.headers["x-biznest-delivery"]).toBe("p1");
    expect(m.prisma.channelPush.update.mock.calls[0][0].data).toMatchObject({ status: "SENT" });
    expect(m.prisma.channelConnection.update.mock.calls[0][0].data).toMatchObject({ lastPushStatus: "OK" });
  });
  it("does nothing when another worker already holds the row", async () => {
    m.prisma.channelPush.updateMany.mockResolvedValue({ count: 0 });
    expect(await deliverPush("p1", NOW)).toBe(false);
    expect(m.safeFetch).not.toHaveBeenCalled();
  });
  it("schedules a retry after a server error", async () => {
    m.safeFetch.mockResolvedValue({ ok: false, status: 502 });
    expect(await deliverPush("p1", NOW)).toBe(false);
    const data = m.prisma.channelPush.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();
    expect(data.attempts).toBe(1);
    expect(data.nextAttemptAt).toEqual(new Date(NOW.getTime() + 60_000));
    expect(m.prisma.channelConnection.update.mock.calls[0][0].data.lastPushMessage).toMatch(/HTTP 502.*Retrying/);
    expect(m.notifyUser).not.toHaveBeenCalled();
  });
  it("gives up after the last attempt and tells the owner once", async () => {
    m.prisma.channelPush.findUnique.mockResolvedValue({ id: "p1", attempts: 5, payload, connection: conn });
    m.safeFetch.mockRejectedValue(new SafeFetchError("Could not reach the website.", "NETWORK"));
    expect(await deliverPush("p1", NOW)).toBe(false);
    expect(m.prisma.channelPush.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED", attempts: 6 });
    expect(m.notifyUser).toHaveBeenCalledTimes(1);
    expect(m.notifyUser.mock.calls[0][0]).toMatchObject({ userId: "u1", type: "CHANNEL_SYNC", url: "/store/test-hotel/admin/pms" });
  });
  it("does not retry an address that resolves to a private network", async () => {
    m.safeFetch.mockRejectedValue(new SafeFetchError("That website address cannot be scanned.", "BLOCKED"));
    await deliverPush("p1", NOW);
    expect(m.prisma.channelPush.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
  });
  it("fails permanently when push was switched off meanwhile", async () => {
    m.prisma.channelPush.findUnique.mockResolvedValue({ id: "p1", attempts: 0, payload, connection: { ...conn, pushUrl: null } });
    await deliverPush("p1", NOW);
    expect(m.safeFetch).not.toHaveBeenCalled();
    expect(m.prisma.channelPush.update.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
  });
});

describe("refreshRoomChannels", () => {
  it("re-reads only stale calendars and survives failures", async () => {
    m.prisma.channelConnection.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    m.syncConnection.mockImplementation(async (id: string) => { if (id === "b") throw new Error("boom"); return { ok: true, blocks: 0, conflicts: 0 }; });
    expect(await refreshRoomChannels("r1")).toEqual({ refreshed: 2 });
    expect(m.syncConnection).toHaveBeenCalledTimes(2);
    const where = m.prisma.channelConnection.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ roomId: { in: ["r1"] }, isActive: true, importUrl: { not: null } });
    expect(where.OR[1].lastSyncAt.lt).toBeInstanceOf(Date);
  });
  it("does nothing when everything is fresh", async () => {
    m.prisma.channelConnection.findMany.mockResolvedValue([]);
    expect(await refreshRoomChannels("r1")).toEqual({ refreshed: 0 });
    expect(m.syncConnection).not.toHaveBeenCalled();
  });
});
