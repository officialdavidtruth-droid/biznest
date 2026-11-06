import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    channelBlock: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    channelConnection: { update: vi.fn() },
  },
  ownStays: vi.fn(),
  afterBlocksChanged: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/channels/sync", () => ({ ownStays: m.ownStays, afterBlocksChanged: m.afterBlocksChanged }));

import { applyInboundEvents } from "@/lib/channels/inbound";

const conn = { id: "c1", storeId: "s1", roomId: "r1", provider: "AIRBNB", label: null };
const d = (s: string) => new Date(`${s}T00:00:00Z`);

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.channelBlock.findMany.mockResolvedValue([]);
  m.prisma.channelBlock.count.mockResolvedValue(1);
  m.ownStays.mockResolvedValue([]);
  m.afterBlocksChanged.mockResolvedValue(undefined);
});

describe("applyInboundEvents", () => {
  it("stores a new booking as a hook block and tells the other channels", async () => {
    const r = await applyInboundEvents(conn, [{ type: "booking.created", uid: "A1", start: d("2026-12-20"), end: d("2026-12-23"), summary: "Reserved" }]);
    expect(r).toEqual({ applied: 1, conflicts: 0 });
    const arg = m.prisma.channelBlock.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ connectionId_uid: { connectionId: "c1", uid: "hook:A1" } });
    expect(arg.create).toMatchObject({ roomId: "r1", uid: "hook:A1", startDate: d("2026-12-20"), endDate: d("2026-12-23") });
    expect(m.afterBlocksChanged).toHaveBeenCalledWith(conn, { changed: true, newConflicts: 0 });
  });
  it("flags a booking that overlaps one of our own stays", async () => {
    m.ownStays.mockResolvedValue([{ start: d("2026-12-21"), end: d("2026-12-24") }]);
    const r = await applyInboundEvents(conn, [{ type: "booking.created", uid: "A1", start: d("2026-12-20"), end: d("2026-12-22"), summary: null }]);
    expect(r.conflicts).toBe(1);
    expect(m.afterBlocksChanged).toHaveBeenCalledWith(conn, { changed: true, newConflicts: 1 });
  });
  it("ignores a replay of an event we already have", async () => {
    m.prisma.channelBlock.findMany.mockResolvedValue([{ uid: "hook:A1", startDate: d("2026-12-20"), endDate: d("2026-12-23") }]);
    await applyInboundEvents(conn, [{ type: "booking.created", uid: "A1", start: d("2026-12-20"), end: d("2026-12-23"), summary: null }]);
    expect(m.prisma.channelBlock.upsert).not.toHaveBeenCalled();
    expect(m.afterBlocksChanged).not.toHaveBeenCalled();
  });
  it("releases dates when a booking is cancelled", async () => {
    m.prisma.channelBlock.deleteMany.mockResolvedValue({ count: 1 });
    await applyInboundEvents(conn, [{ type: "booking.cancelled", uid: "A1" }]);
    expect(m.prisma.channelBlock.deleteMany).toHaveBeenCalledWith({ where: { connectionId: "c1", uid: "hook:A1" } });
    expect(m.afterBlocksChanged).toHaveBeenCalledWith(conn, { changed: true, newConflicts: 0 });
  });
  it("lets the last event for a uid win and ignores cancelling something unknown", async () => {
    m.prisma.channelBlock.deleteMany.mockResolvedValue({ count: 0 });
    await applyInboundEvents(conn, [
      { type: "booking.created", uid: "A1", start: d("2026-12-20"), end: d("2026-12-23"), summary: null },
      { type: "booking.cancelled", uid: "A1" },
    ]);
    expect(m.prisma.channelBlock.upsert).not.toHaveBeenCalled();
    expect(m.afterBlocksChanged).not.toHaveBeenCalled();
  });
});
