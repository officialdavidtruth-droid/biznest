import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  perm: vi.fn(), entitlement: vi.fn(), tripFind: vi.fn(), tripUpdate: vi.fn(), itemFindMany: vi.fn(), itemCreate: vi.fn(), itemUpdate: vi.fn(), itemFind: vi.fn(), suppFind: vi.fn(),
}));
vi.mock("@prisma/client", () => ({ Prisma: { DbNull: "DB_NULL" } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    travelTrip: { findFirst: m.tripFind, update: m.tripUpdate },
    travelSupplier: { findFirst: m.suppFind },
    travelTripItem: { findMany: m.itemFindMany, create: m.itemCreate, update: m.itemUpdate, findFirst: m.itemFind },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.perm }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/payments/travel-charge", () => ({ startTravelCharge: vi.fn(), travelOnlinePaymentError: vi.fn() }));
vi.mock("@/lib/payments/refund-travel", () => ({ refundTravelPayment: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "o@x.test" } }) }));

import { saveTravelItem } from "@/lib/actions/travel";

const store = { id: "s1", currency: "NGN", businessType: "Travel & Tourism", business: { category: "Travel & Tourism" } };
const base = { kind: "FLIGHT", description: "Lagos–Dubai return", costPrice: 0, sellPrice: 900_000 };
const flight = { airline: "Emirates", flightNumber: "ek783", origin: "los", destination: "dxb", departAt: "2027-06-01T08:30", pnr: "x7k2pq", tickets: [{ name: "Ada", number: "1761234567890" }] };

beforeEach(() => {
  vi.clearAllMocks();
  m.perm.mockResolvedValue({ success: true, store });
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
  m.tripFind.mockResolvedValue({ id: "t1", status: "QUOTED", totalPrice: "0", totalCost: "0", currency: "NGN" });
  m.itemFindMany.mockResolvedValue([]);
  m.itemFind.mockResolvedValue({ id: "i1" });
});

describe("flight details on a service line", () => {
  it("stores cleaned details and the deadline, and re-arms the reminder", async () => {
    const r = await saveTravelItem("wander", "t1", { ...base, flight, ticketingDeadline: "2027-05-20T00:00:00.000Z" });
    expect(r.success).toBe(true);
    const d = m.itemCreate.mock.calls[0][0].data;
    expect(d.flightDetails).toMatchObject({ flightNumber: "EK783", origin: "LOS", pnr: "X7K2PQ", tickets: [{ name: "Ada", number: "176-1234567890" }] });
    expect(d.ticketingDeadline).toEqual(new Date("2027-05-20T00:00:00.000Z"));
    expect(d.ticketingAlertedAt).toBeNull();
  });
  it("refuses bad details without saving", async () => {
    const r = await saveTravelItem("wander", "t1", { ...base, flight: { ...flight, flightNumber: "783" } });
    expect(r.success).toBe(false);
    expect(m.itemCreate).not.toHaveBeenCalled();
    expect((await saveTravelItem("wander", "t1", { ...base, ticketingDeadline: "soon" })).success).toBe(false);
  });
  it("leaves flight data alone when the caller sends none (Confirm button)", async () => {
    await saveTravelItem("wander", "t1", { ...base, id: "i1", status: "CONFIRMED" });
    const d = m.itemUpdate.mock.calls[0][0].data;
    expect(d).not.toHaveProperty("flightDetails");
    expect(d).not.toHaveProperty("ticketingDeadline");
  });
  it("clears details when emptied, and when the line stops being a flight", async () => {
    await saveTravelItem("wander", "t1", { ...base, id: "i1", flight: {}, ticketingDeadline: null });
    expect(m.itemUpdate.mock.calls[0][0].data).toMatchObject({ flightDetails: "DB_NULL", ticketingDeadline: null });
    await saveTravelItem("wander", "t1", { ...base, kind: "HOTEL", id: "i1" });
    expect(m.itemUpdate.mock.calls[1][0].data).toMatchObject({ flightDetails: "DB_NULL", ticketingDeadline: null, ticketingAlertedAt: null });
  });
  it("ignores flight data sent for a non-flight line", async () => {
    await saveTravelItem("wander", "t1", { ...base, kind: "HOTEL", flight });
    expect(m.itemCreate.mock.calls[0][0].data).not.toHaveProperty("flightDetails");
  });
});
