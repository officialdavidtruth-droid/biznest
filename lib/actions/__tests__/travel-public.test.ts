import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  storeFind: vi.fn(), pkgFind: vi.fn(), travelerCount: vi.fn(), clientFind: vi.fn(), clientCreate: vi.fn(), tripCount: vi.fn(), tripCreate: vi.fn(),
  rate: vi.fn(), entitlement: vi.fn(), charge: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findUnique: m.storeFind },
    travelPackage: { findFirst: m.pkgFind },
    travelTraveler: { count: m.travelerCount },
    travelClient: { findFirst: m.clientFind, create: m.clientCreate },
    travelTrip: { count: m.tripCount, create: m.tripCreate },
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/payments/travel-charge", () => ({ startTravelCharge: m.charge }));

import { submitTravelEnquiry, startTravelBooking } from "@/lib/actions/travel-public";

const good = { fullName: "Ada Obi", phone: "08031234567", email: "ada@example.com", travellers: 2, packageId: "pkg1" };
const pkg = (over: Record<string, unknown> = {}) => ({ id: "pkg1", name: "Dubai Escape", destination: "Dubai", durationDays: 5, pricePerPerson: "100000", currency: "NGN", departureDate: new Date("2027-03-01"), seats: 10, depositPercent: 30, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  m.rate.mockResolvedValue({ allowed: true });
  m.storeFind.mockResolvedValue({ id: "storeA", slug: "wander", status: "ACTIVE", currency: "NGN", customDomain: null, customDomainStatus: "NONE" });
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
  m.pkgFind.mockResolvedValue(pkg());
  m.travelerCount.mockResolvedValue(0);
  m.clientFind.mockResolvedValue(null);
  m.clientCreate.mockResolvedValue({ id: "client1", fullName: "Ada Obi" });
  m.tripCount.mockResolvedValue(0);
  m.tripCreate.mockResolvedValue({ id: "trip1", reference: "TRV-2611-ABCD" });
  m.charge.mockResolvedValue({ success: true, url: "https://pay.example/checkout" });
});

describe("submitTravelEnquiry", () => {
  it("silently accepts bots that fill the honeypot, without touching the database", async () => {
    const r = await submitTravelEnquiry("wander", { ...good, website: "http://spam" });
    expect(r.success).toBe(true);
    expect(m.storeFind).not.toHaveBeenCalled();
    expect(m.tripCreate).not.toHaveBeenCalled();
  });

  it("validates name, phone and email", async () => {
    expect((await submitTravelEnquiry("wander", { ...good, fullName: "A" })).success).toBe(false);
    expect((await submitTravelEnquiry("wander", { ...good, phone: "123" })).success).toBe(false);
    expect((await submitTravelEnquiry("wander", { ...good, email: "not-an-email" })).success).toBe(false);
    expect(m.tripCreate).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    m.rate.mockResolvedValue({ allowed: false });
    const r = await submitTravelEnquiry("wander", good);
    expect(r.success).toBe(false);
    expect(m.tripCreate).not.toHaveBeenCalled();
  });

  it("refuses stores that are inactive or do not have BizNest Travel installed", async () => {
    m.entitlement.mockResolvedValue({ allowed: true, installed: false });
    expect((await submitTravelEnquiry("wander", good)).success).toBe(false);
    m.entitlement.mockResolvedValue({ allowed: true, installed: true });
    m.storeFind.mockResolvedValue({ id: "storeA", status: "SUSPENDED" });
    expect((await submitTravelEnquiry("wander", good)).success).toBe(false);
    expect(m.tripCreate).not.toHaveBeenCalled();
  });

  it("only finds packages that belong to this store (two-store isolation)", async () => {
    m.pkgFind.mockResolvedValue(null); // package of store B does not match storeA's filter
    const r = await submitTravelEnquiry("wander", { ...good, packageId: "pkgOfStoreB" });
    expect(r).toEqual({ success: false, error: "That tour is no longer available." });
    expect(m.pkgFind.mock.calls[0][0].where).toMatchObject({ id: "pkgOfStoreB", storeId: "storeA", isActive: true });
  });

  it("scopes client lookup and creation to the store", async () => {
    await submitTravelEnquiry("wander", good);
    expect(m.clientFind.mock.calls[0][0].where.storeId).toBe("storeA");
    expect(m.clientCreate.mock.calls[0][0].data.storeId).toBe("storeA");
    expect(m.tripCreate.mock.calls[0][0].data.storeId).toBe("storeA");
  });

  it("rejects a fully booked tour and reports the seats left", async () => {
    m.travelerCount.mockResolvedValue(9); // 1 seat left, 2 requested
    const r = await submitTravelEnquiry("wander", good);
    expect(r).toEqual({ success: false, error: "Only 1 seat(s) left on this tour." });
    expect(m.tripCreate).not.toHaveBeenCalled();
    m.travelerCount.mockResolvedValue(10);
    expect((await submitTravelEnquiry("wander", good)).success).toBe(false);
  });

  it("takes the price from the package, never from the browser, and does not start a payment", async () => {
    const r = await submitTravelEnquiry("wander", { ...good, ...({ totalPrice: 1 } as object) });
    expect(r.success).toBe(true);
    const data = m.tripCreate.mock.calls[0][0].data;
    expect(data.totalPrice).toBe(200000);
    expect(data.packageId).toBe("pkg1");
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("stops one contact flooding the agency with open enquiries", async () => {
    m.clientFind.mockResolvedValue({ id: "client1", fullName: "Ada Obi" });
    m.tripCount.mockResolvedValue(5);
    const r = await submitTravelEnquiry("wander", good);
    expect(r.success).toBe(false);
    expect(m.tripCreate).not.toHaveBeenCalled();
  });
});

describe("startTravelBooking", () => {
  it("requires a tour", async () => {
    const r = await startTravelBooking("wander", { ...good, packageId: undefined });
    expect(r.success).toBe(false);
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("charges the agency's deposit percent for all travellers and returns the checkout link", async () => {
    const r = await startTravelBooking("wander", good); // 2 x 100,000 x 30%
    expect(r).toEqual({ success: true, data: { reference: "TRV-2611-ABCD", paymentUrl: "https://pay.example/checkout" } });
    expect(m.charge.mock.calls[0][0]).toMatchObject({ tripId: "trip1", amountNaira: 60000, currency: "NGN" });
    expect(m.charge.mock.calls[0][0].store.id).toBe("storeA");
  });

  it("charges in full when the deposit is 100%", async () => {
    m.pkgFind.mockResolvedValue(pkg({ depositPercent: 100 }));
    await startTravelBooking("wander", good);
    expect(m.charge.mock.calls[0][0].amountNaira).toBe(200000);
  });

  it("refuses online booking for non-NGN tours and tours with no deposit set", async () => {
    m.pkgFind.mockResolvedValue(pkg({ currency: "USD" }));
    expect((await startTravelBooking("wander", good)).success).toBe(false);
    m.pkgFind.mockResolvedValue(pkg({ depositPercent: 0 }));
    expect((await startTravelBooking("wander", good)).success).toBe(false);
    expect(m.charge).not.toHaveBeenCalled();
    expect(m.tripCreate).not.toHaveBeenCalled();
  });

  it("refuses a fully booked tour before creating anything", async () => {
    m.travelerCount.mockResolvedValue(10);
    expect((await startTravelBooking("wander", good)).success).toBe(false);
    expect(m.tripCreate).not.toHaveBeenCalled();
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("keeps the saved enquiry and tells the visitor when checkout cannot start", async () => {
    m.charge.mockResolvedValue({ success: false, error: "Gateway unavailable." });
    const r = await startTravelBooking("wander", good);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain("TRV-2611-ABCD");
  });
});
