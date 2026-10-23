import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ONLINE_BOOKING_HOLD_MINUTES,
  busyUnitIds,
  findBookingOverlapForUnit,
  findPmsConflictForUnit,
  getBusyIntervals,
  type BusyInterval,
} from "@/lib/stay-availability";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("busyUnitIds", () => {
  const intervals: BusyInterval[] = [
    { unitId: "u1", checkIn: d("2026-11-10"), checkOut: d("2026-11-12"), source: "booking" },
    { unitId: "u2", checkIn: d("2026-11-12"), checkOut: d("2026-11-15"), source: "pms" },
  ];
  it("marks units that overlap the stay", () => {
    expect([...busyUnitIds(intervals, d("2026-11-11"), d("2026-11-13"))].sort()).toEqual(["u1", "u2"]);
  });
  it("treats stays as half-open: leaving the day another guest arrives is fine", () => {
    expect([...busyUnitIds(intervals, d("2026-11-12"), d("2026-11-14"))]).toEqual(["u2"]);
    expect(busyUnitIds(intervals, d("2026-11-08"), d("2026-11-10")).size).toBe(0);
  });
});

describe("getBusyIntervals", () => {
  const client = (over: Record<string, unknown> = {}) =>
    ({
      booking: { findMany: vi.fn().mockResolvedValue([{ unitId: "u1", checkIn: d("2026-11-10"), checkOut: d("2026-11-12") }]) },
      propertyRoom: { findMany: vi.fn().mockResolvedValue([{ id: "r2", serviceUnitId: "u2" }]) },
      propertyReservation: { findMany: vi.fn().mockResolvedValue([{ roomId: "r2", checkIn: d("2026-11-13"), checkOut: d("2026-11-15") }]) },
      channelBlock: { findMany: vi.fn().mockResolvedValue([{ roomId: "r2", startDate: d("2026-11-20"), endDate: d("2026-11-22") }]) },
      ...over,
    }) as never;

  it("combines online bookings, front-desk reservations and OTA blocks, attributed to the linked unit", async () => {
    const out = await getBusyIntervals(client(), "svc", d("2026-11-01"), d("2026-12-01"));
    expect(out.map((i) => [i.unitId, i.source])).toEqual([
      ["u1", "booking"],
      ["u2", "pms"],
      ["u2", "channel"],
    ]);
  });

  it("only looks at PMS rooms linked to a unit of this service, with active statuses and active channels", async () => {
    const c = client();
    await getBusyIntervals(c, "svc", d("2026-11-01"), d("2026-12-01"));
    const anyC = c as unknown as Record<string, { findMany: ReturnType<typeof vi.fn> }>;
    expect(anyC.propertyRoom.findMany.mock.calls[0][0].where).toEqual({ serviceUnit: { serviceId: "svc" } });
    expect(anyC.propertyReservation.findMany.mock.calls[0][0].where.status).toEqual({ in: ["PENDING", "CONFIRMED", "CHECKED_IN"] });
    expect(anyC.channelBlock.findMany.mock.calls[0][0].where.connection).toEqual({ isActive: true });
  });

  it("skips the PMS queries entirely when no rooms are linked (online-only hotels unchanged)", async () => {
    const c = client({ propertyRoom: { findMany: vi.fn().mockResolvedValue([]) } });
    const out = await getBusyIntervals(c, "svc", d("2026-11-01"), d("2026-12-01"));
    expect(out).toHaveLength(1);
    const anyC = c as unknown as Record<string, { findMany: ReturnType<typeof vi.fn> }>;
    expect(anyC.propertyReservation.findMany).not.toHaveBeenCalled();
    expect(anyC.channelBlock.findMany).not.toHaveBeenCalled();
  });

  it("ignores bookings with no unit attached", async () => {
    const c = client({ booking: { findMany: vi.fn().mockResolvedValue([{ unitId: null, checkIn: d("2026-11-10"), checkOut: d("2026-11-12") }]) }, propertyRoom: { findMany: vi.fn().mockResolvedValue([]) } });
    expect(await getBusyIntervals(c, "svc", d("2026-11-01"), d("2026-12-01"))).toEqual([]);
  });
});

describe("findBookingOverlapForUnit", () => {
  it("excludes cancelled bookings and expired unpaid holds", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await findBookingOverlapForUnit({ booking: { findFirst } } as never, "u1", d("2026-11-10"), d("2026-11-12"));
    const where = findFirst.mock.calls[0][0].where;
    expect(where.unitId).toBe("u1");
    expect(where.AND[0]).toEqual({ status: { not: "CANCELLED" } });
    expect(where.AND[1].OR[0]).toEqual({ status: { not: "PENDING" } });
    expect(where.AND[1].OR[1].createdAt.gte).toBeInstanceOf(Date);
  });
});

describe("findPmsConflictForUnit", () => {
  const mk = (room: unknown, reservation: unknown, block: unknown) =>
    ({
      propertyRoom: { findFirst: vi.fn().mockResolvedValue(room) },
      propertyReservation: { findFirst: vi.fn().mockResolvedValue(reservation) },
      channelBlock: { findFirst: vi.fn().mockResolvedValue(block) },
    }) as never;

  it("is null when the unit has no linked PMS room", async () => {
    expect(await findPmsConflictForUnit(mk(null, null, null), "u1", d("2026-11-10"), d("2026-11-12"))).toBeNull();
  });
  it("reports a front-desk reservation or an OTA block", async () => {
    expect(await findPmsConflictForUnit(mk({ id: "r1" }, { id: "x" }, null), "u1", d("2026-11-10"), d("2026-11-12"))).toMatch(/front desk/);
    expect(await findPmsConflictForUnit(mk({ id: "r1" }, null, { id: "y" }), "u1", d("2026-11-10"), d("2026-11-12"))).toMatch(/channel/);
    expect(await findPmsConflictForUnit(mk({ id: "r1" }, null, null), "u1", d("2026-11-10"), d("2026-11-12"))).toBeNull();
  });
});

describe("hold window stays in sync with booking.ts", () => {
  it("uses the same number of minutes as the online booking hold", () => {
    const src = readFileSync(path.join(__dirname, "../actions/booking.ts"), "utf8");
    const m = src.match(/ONLINE_BOOKING_HOLD_MINUTES = (\d+)/);
    expect(Number(m?.[1])).toBe(ONLINE_BOOKING_HOLD_MINUTES);
  });
});
