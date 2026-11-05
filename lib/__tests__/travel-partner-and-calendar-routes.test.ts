import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ storeFind: vi.fn(), pkgFindMany: vi.fn(), entitlement: vi.fn(), rate: vi.fn(), packages: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { store: { findUnique: m.storeFind }, travelPackage: { findMany: m.pkgFindMany } } }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate, getClientIp: () => "1.1.1.1" }));
vi.mock("@/lib/travel-public", () => ({ getPublicTravelPackages: m.packages }));
vi.mock("@/lib/travel-proposal", async () => {
  const { createHash } = await import("node:crypto");
  return { hashPartnerKey: (k: string) => createHash("sha256").update(k).digest("hex"), loadProposal: m.load };
});

import { createHash } from "node:crypto";
import { GET as partner } from "@/app/api/store/[slug]/travel/partner/route";
import { GET as calendar } from "@/app/api/store/[slug]/travel/calendar/route";
import { GET as tripCalendar } from "@/app/api/store/[slug]/travel/proposal/[token]/calendar/route";

const KEY = "tpk_secretkey1234";
const hash = createHash("sha256").update(KEY).digest("hex");
const ctx = { params: Promise.resolve({ slug: "wander" }) };
const req = (headers: Record<string, string> = {}) => new Request("https://x.test/api", { headers });

beforeEach(() => {
  vi.clearAllMocks();
  m.rate.mockResolvedValue({ allowed: true });
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
  m.storeFind.mockResolvedValue({ id: "storeA", name: "Wander", slug: "wander", status: "ACTIVE", currency: "NGN", customDomain: null, customDomainStatus: "NONE", travelSettings: { partnerKeyHash: hash } });
  m.packages.mockResolvedValue([{ id: "pkg1", departureId: "dep1", name: "Dubai", destination: "Dubai", durationDays: 5, departureDate: "2027-06-01T00:00:00.000Z", pricePerPerson: 250000, currency: "NGN", seatsLeft: 4, bookable: true, depositPercent: 30, inclusions: "Hotel" }]);
});

describe("partner feed", () => {
  it("rejects missing, wrong and revoked keys", async () => {
    expect((await partner(req(), ctx)).status).toBe(401);
    expect((await partner(req({ authorization: "Bearer nope" }), ctx)).status).toBe(401);
    m.storeFind.mockResolvedValue({ id: "storeA", status: "ACTIVE", travelSettings: { partnerKeyHash: null } });
    expect((await partner(req({ authorization: `Bearer ${KEY}` }), ctx)).status).toBe(401);
    expect(m.packages).not.toHaveBeenCalled();
  });

  it("returns live availability for a valid key, with no internal fields", async () => {
    const res = await partner(req({ authorization: `Bearer ${KEY}` }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.departures[0]).toMatchObject({ packageId: "pkg1", departureId: "dep1", seatsLeft: 4, bookableOnline: true, pricePerPerson: 250000 });
    expect(JSON.stringify(body)).not.toMatch(/partnerKey|hash/i);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("is rate limited and honours a suspended store or an uninstalled app", async () => {
    m.rate.mockResolvedValue({ allowed: false });
    expect((await partner(req({ authorization: `Bearer ${KEY}` }), ctx)).status).toBe(429);
    m.rate.mockResolvedValue({ allowed: true });
    m.storeFind.mockResolvedValue({ id: "storeA", status: "SUSPENDED", travelSettings: { partnerKeyHash: hash } });
    expect((await partner(req({ authorization: `Bearer ${KEY}` }), ctx)).status).toBe(401);
    m.storeFind.mockResolvedValue({ id: "storeA", name: "W", slug: "wander", status: "ACTIVE", travelSettings: { partnerKeyHash: hash } });
    m.entitlement.mockResolvedValue({ allowed: true, installed: false });
    expect((await partner(req({ authorization: `Bearer ${KEY}` }), ctx)).status).toBe(403);
  });
});

describe("public departures calendar", () => {
  it("lists upcoming departures as all-day events with no prices", async () => {
    m.pkgFindMany.mockResolvedValue([{ id: "pkg1", name: "Dubai", destination: "Dubai", durationDays: 5, departureDate: new Date(Date.now() + 40 * 86_400_000), departures: [{ id: "dep1", departureDate: new Date(Date.now() + 90 * 86_400_000) }] }]);
    const res = await calendar(req(), ctx);
    const text = await res.text();
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text).toContain("SUMMARY:Dubai (Dubai)");
    expect(text).not.toMatch(/price|seats/i);
  });
  it("404s for unknown stores and stores without the app", async () => {
    m.storeFind.mockResolvedValue(null);
    expect((await calendar(req(), ctx)).status).toBe(404);
    m.storeFind.mockResolvedValue({ id: "storeA", name: "W", status: "ACTIVE" });
    m.entitlement.mockResolvedValue({ allowed: true, installed: false });
    expect((await calendar(req(), ctx)).status).toBe(404);
  });
});

describe("trip calendar for the client", () => {
  it("builds the trip plus dated services from the proposal view", async () => {
    m.load.mockResolvedValue({ trip: { id: "t1", title: "Dubai", destination: "Dubai", reference: "TRV-1", departDate: "2027-06-01T00:00:00.000Z", returnDate: "2027-06-07T00:00:00.000Z" }, store: { name: "Wander" }, items: [{ description: "Flight LOS-DXB", startDate: "2027-06-01T00:00:00.000Z", endDate: null, status: "CONFIRMED" }, { description: "Cancelled hotel", startDate: "2027-06-02T00:00:00.000Z", endDate: null, status: "CANCELLED" }] });
    const res = await tripCalendar(req(), { params: Promise.resolve({ slug: "wander", token: "abcdefghijklmnopqrstuvwx" }) });
    const text = await res.text();
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text).toContain("DTEND;VALUE=DATE:20270608");
    expect(text).not.toContain("Cancelled hotel");
  });
  it("404s for an invalid link", async () => {
    m.load.mockResolvedValue(null);
    expect((await tripCalendar(req(), { params: Promise.resolve({ slug: "wander", token: "x" }) })).status).toBe(404);
  });
});
