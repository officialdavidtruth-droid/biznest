import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  class KnownError extends Error {
    code: string;
    meta?: { code?: string };
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  const tx = {
    $executeRaw: vi.fn(),
    propertyReservation: { findFirst: vi.fn(), create: vi.fn() },
    propertyRoom: { update: vi.fn() },
    booking: { findFirst: vi.fn() },
  };
  return {
    KnownError,
    tx,
    guestFind: vi.fn(),
    roomFind: vi.fn(),
    roomFindMany: vi.fn(),
    roomUpdate: vi.fn(),
    unitFind: vi.fn(),
    unitFindMany: vi.fn(),
    transaction: vi.fn(),
    channelOverlap: vi.fn(),
  };
});
const KnownError = m.KnownError;

vi.mock("@prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: m.KnownError } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    propertyGuest: { findFirst: m.guestFind },
    propertyRoom: { findFirst: m.roomFind, findMany: m.roomFindMany, update: m.roomUpdate },
    serviceUnit: { findFirst: m.unitFind, findMany: m.unitFindMany },
    $transaction: m.transaction,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn().mockResolvedValue({ success: true, store: { id: "s1", business: { category: "HOTEL" } } }),
}));
vi.mock("@/lib/capabilities", () => ({ hasCapability: () => true }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: vi.fn().mockResolvedValue({ allowed: true, installed: true }) }));
vi.mock("@/lib/payments/payout-target", () => ({ storeHasPayoutTarget: vi.fn() }));
vi.mock("@/lib/payments/gateway", () => ({ chargeCustomer: vi.fn(), getActiveGateway: vi.fn() }));
vi.mock("@/lib/payments/pending", () => ({ createPendingPayment: vi.fn(), markPaymentFailed: vi.fn() }));
vi.mock("@/lib/channels/sync", () => ({ findChannelBlockOverlap: m.channelOverlap }));

import { autoLinkRoomsToUnits, createReservation, linkRoomToUnit } from "@/lib/actions/pms";

const input = { guestId: "g1", roomId: "r1", checkIn: "2026-11-10", checkOut: "2026-11-12" };

beforeEach(() => {
  vi.clearAllMocks();
  m.guestFind.mockResolvedValue({ id: "g1" });
  m.roomFind.mockResolvedValue({ id: "r1", status: "AVAILABLE", serviceUnitId: "u1" });
  m.transaction.mockImplementation(async (fn: (tx: typeof m.tx) => unknown) => fn(m.tx));
  m.tx.propertyReservation.findFirst.mockResolvedValue(null);
  m.tx.propertyReservation.create.mockResolvedValue({ id: "res1" });
  m.tx.booking.findFirst.mockResolvedValue(null);
  m.channelOverlap.mockResolvedValue(null);
});

describe("createReservation vs online bookings", () => {
  it("refuses a room whose linked online unit is already booked online for those dates", async () => {
    m.tx.booking.findFirst.mockResolvedValue({ id: "b1", source: "Online" });
    const r = await createReservation("hotel", input);
    expect(r).toEqual({ success: false, error: "That room is already booked online for part of those dates." });
    expect(m.tx.propertyReservation.create).not.toHaveBeenCalled();
    expect(m.tx.booking.findFirst.mock.calls[0][0].where.unitId).toBe("u1");
  });

  it("creates the reservation when the linked unit is free", async () => {
    const r = await createReservation("hotel", input);
    expect(r).toEqual({ success: true, data: { id: "res1" } });
    expect(m.tx.propertyReservation.create).toHaveBeenCalled();
  });

  it("does not look at online bookings for a room that isn't linked", async () => {
    m.roomFind.mockResolvedValue({ id: "r1", status: "AVAILABLE", serviceUnitId: null });
    const r = await createReservation("hotel", input);
    expect(r.success).toBe(true);
    expect(m.tx.booking.findFirst).not.toHaveBeenCalled();
  });

  it("runs under Serializable isolation so it can race safely with online bookings", async () => {
    await createReservation("hotel", input);
    expect(m.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
  });

  it("retries a serialization failure and then succeeds", async () => {
    m.transaction.mockRejectedValueOnce(new KnownError("P2034")).mockImplementation(async (fn: (tx: typeof m.tx) => unknown) => fn(m.tx));
    const r = await createReservation("hotel", input);
    expect(r.success).toBe(true);
    expect(m.transaction).toHaveBeenCalledTimes(2);
  });

  it("gives a friendly error if it keeps losing the race", async () => {
    m.transaction.mockRejectedValue(new KnownError("P2034"));
    const r = await createReservation("hotel", input);
    expect(r.success).toBe(false);
    expect(m.transaction).toHaveBeenCalledTimes(3);
  });

  it("does not swallow unrelated database errors", async () => {
    m.transaction.mockRejectedValue(new Error("connection lost"));
    await expect(createReservation("hotel", input)).rejects.toThrow("connection lost");
  });
});

describe("linkRoomToUnit", () => {
  it("links a room to a unit in the same store", async () => {
    m.unitFind.mockResolvedValue({ id: "u1" });
    m.roomFind.mockResolvedValueOnce({ id: "r1" }).mockResolvedValueOnce(null);
    expect((await linkRoomToUnit("hotel", "r1", "u1")).success).toBe(true);
    expect(m.roomUpdate).toHaveBeenCalledWith({ where: { id: "r1" }, data: { serviceUnitId: "u1" } });
  });

  it("refuses a unit already linked to another room (one-to-one)", async () => {
    m.unitFind.mockResolvedValue({ id: "u1" });
    m.roomFind.mockResolvedValueOnce({ id: "r1" }).mockResolvedValueOnce({ name: "102" });
    const r = await linkRoomToUnit("hotel", "r1", "u1");
    expect(r).toEqual({ success: false, error: "That online unit is already linked to room 102." });
    expect(m.roomUpdate).not.toHaveBeenCalled();
  });

  it("refuses a unit from another store", async () => {
    m.roomFind.mockResolvedValueOnce({ id: "r1" });
    m.unitFind.mockResolvedValue(null);
    expect((await linkRoomToUnit("hotel", "r1", "uX")).success).toBe(false);
  });

  it("unlinks with null", async () => {
    m.roomFind.mockResolvedValueOnce({ id: "r1" });
    expect((await linkRoomToUnit("hotel", "r1", null)).success).toBe(true);
    expect(m.roomUpdate).toHaveBeenCalledWith({ where: { id: "r1" }, data: { serviceUnitId: null } });
  });
});

describe("autoLinkRoomsToUnits", () => {
  it("links only unambiguous exact-name matches and leaves linked/ambiguous ones alone", async () => {
    m.roomFindMany.mockResolvedValue([
      { id: "r101", name: "101", serviceUnitId: null },
      { id: "r102", name: "102", serviceUnitId: null },
      { id: "r103", name: "103", serviceUnitId: "u103" },
      { id: "r104", name: "104", serviceUnitId: null },
    ]);
    m.unitFindMany.mockResolvedValue([
      { id: "u101", label: " 101 " },
      { id: "u102a", label: "102" },
      { id: "u102b", label: "102" }, // two units called 102: ambiguous
      { id: "u103", label: "103" },
      { id: "uX", label: "Penthouse" },
    ]);
    const r = await autoLinkRoomsToUnits("hotel");
    expect(r).toEqual({ success: true, data: { linked: 1 } });
    expect(m.roomUpdate).toHaveBeenCalledTimes(1);
    expect(m.roomUpdate).toHaveBeenCalledWith({ where: { id: "r101" }, data: { serviceUnitId: "u101" } });
  });
});
