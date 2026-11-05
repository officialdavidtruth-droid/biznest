import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  perm: vi.fn(), entitlement: vi.fn(), tripFind: vi.fn(), tripUpdate: vi.fn(), pkgFind: vi.fn(), pkgUpdateMany: vi.fn(),
  travelerCount: vi.fn(), travelerCreate: vi.fn(), itemFindMany: vi.fn(), itemDeleteMany: vi.fn(),
}));

vi.mock("@prisma/client", () => ({ Prisma: { DbNull: "DB_NULL" } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    travelTrip: { findFirst: m.tripFind, update: m.tripUpdate },
    travelPackage: { findUnique: m.pkgFind, updateMany: m.pkgUpdateMany },
    travelTraveler: { count: m.travelerCount, create: m.travelerCreate },
    travelTripItem: { findMany: m.itemFindMany, deleteMany: m.itemDeleteMany },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.perm }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/payments/travel-charge", () => ({ startTravelCharge: vi.fn(), travelOnlinePaymentError: vi.fn() }));
vi.mock("@/lib/payments/refund-travel", () => ({ refundTravelPayment: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "o@x.test" } }) }));

import { removeTravelItem, saveTravelPackage, saveTravelTraveler, updateTravelTrip } from "@/lib/actions/travel";

const store = { id: "s1", currency: "NGN", businessType: "Travel & Tourism", business: { category: "Travel & Tourism" } };

beforeEach(() => {
  vi.clearAllMocks();
  m.perm.mockResolvedValue({ success: true, store });
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
});

describe("closed trips are read-only", () => {
  it.each(["COMPLETED", "CANCELLED"])("refuses to edit a %s trip", async (status) => {
    m.tripFind.mockResolvedValue({ id: "t1", status, departDate: null, returnDate: null, packageId: null });
    const r = await updateTravelTrip("wander", "t1", { totalPrice: 1 });
    expect(r.success).toBe(false);
    expect(m.tripUpdate).not.toHaveBeenCalled();
    const r2 = await saveTravelTraveler("wander", "t1", { fullName: "Bola Ade" });
    expect(r2.success).toBe(false);
    expect(m.travelerCreate).not.toHaveBeenCalled();
  });

  it("checks a new return date against the saved departure date", async () => {
    m.tripFind.mockResolvedValue({ id: "t1", status: "ENQUIRY", departDate: new Date("2026-12-10"), returnDate: null, packageId: null });
    const r = await updateTravelTrip("wander", "t1", { returnDate: "2026-12-01" });
    expect(r.success).toBe(false);
    expect(m.tripUpdate).not.toHaveBeenCalled();
  });
});

describe("seat limits", () => {
  it("won't add a traveller to a confirmed trip when the package is full", async () => {
    m.tripFind.mockResolvedValue({ id: "t1", status: "CONFIRMED", packageId: "p1" });
    m.pkgFind.mockResolvedValue({ seats: 10, name: "Dubai Escape" });
    m.travelerCount.mockResolvedValue(10);
    const r = await saveTravelTraveler("wander", "t1", { fullName: "Bola Ade" });
    expect(r.success).toBe(false);
    expect(m.travelerCreate).not.toHaveBeenCalled();
  });

  it("adds a traveller when a seat is free", async () => {
    m.tripFind.mockResolvedValue({ id: "t1", status: "CONFIRMED", packageId: "p1" });
    m.pkgFind.mockResolvedValue({ seats: 10, name: "Dubai Escape" });
    m.travelerCount.mockResolvedValue(9);
    const r = await saveTravelTraveler("wander", "t1", { fullName: "Bola Ade" });
    expect(r.success).toBe(true);
    expect(m.travelerCreate).toHaveBeenCalledOnce();
  });

  it("won't lower a package's seats below the seats already held", async () => {
    m.travelerCount.mockResolvedValue(8);
    const r = await saveTravelPackage("wander", { id: "p1", name: "Dubai Escape", destination: "Dubai", durationDays: 5, pricePerPerson: 900000, seats: 6 });
    expect(r.success).toBe(false);
    expect(m.pkgUpdateMany).not.toHaveBeenCalled();
  });
});

describe("trip totals", () => {
  it("resets the supplier cost when the last service line is removed", async () => {
    m.tripFind.mockResolvedValue({ id: "t1", status: "ENQUIRY", totalPrice: 500000, totalCost: 400000 });
    m.itemFindMany.mockResolvedValue([]);
    const r = await removeTravelItem("wander", "t1", "i1");
    expect(r.success).toBe(true);
    expect(m.tripUpdate).toHaveBeenCalledWith({ where: { id: "t1" }, data: { totalCost: 0 } });
  });
});
