import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ tripFind: vi.fn(), entitlement: vi.fn(), online: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { travelTrip: { findUnique: m.tripFind } } }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/payments/travel-charge", () => ({ travelOnlinePaymentError: m.online }));
vi.mock("server-only", () => ({}));

import { loadProposal, newShareToken, hashPartnerKey, TOKEN_RE } from "@/lib/travel-proposal";

const TOKEN = "abcdefghijklmnopqrstuvwx";
const row = (over: Record<string, unknown> = {}) => ({
  id: "trip1", reference: "TRV-1", title: "Dubai", destination: "Dubai", status: "QUOTED", currency: "NGN", totalPrice: "600000", totalCost: "420000",
  departDate: new Date("2027-06-01"), returnDate: new Date("2027-06-07"), proposalNote: "Hello", proposalValidUntil: null, proposalSentAt: new Date(), termsText: "Terms", acceptedAt: null, acceptedName: null,
  commissionRate: "10", notes: "INTERNAL: client is difficult", shareToken: TOKEN,
  store: { id: "storeA", slug: "wander", name: "Wander", logoUrl: null, themeColors: { primary: "#0f766e" }, contactEmail: "hi@w.test", contactPhone: null, status: "ACTIVE", customDomain: null, customDomainStatus: "NONE" },
  client: { fullName: "Ada Obi" }, package: { depositPercent: 30 },
  travellers: [{ fullName: "Ada Obi", isLead: true }],
  items: [{ kind: "HOTEL", description: "Atlantis", startDate: null, endDate: null, status: "CONFIRMED", sellPrice: "600000", costPrice: "420000", supplier: { name: "SECRET SUPPLIER" } }],
  itineraryDays: [{ dayNumber: 1, title: "Arrive", description: null }],
  payments: [], ...over,
});

beforeEach(() => { vi.clearAllMocks(); m.entitlement.mockResolvedValue({ allowed: true, installed: true }); m.online.mockResolvedValue(null); m.tripFind.mockResolvedValue(row()); });

describe("loadProposal", () => {
  it("never exposes costs, commission, suppliers or internal notes", async () => {
    const v = await loadProposal("wander", TOKEN);
    const json = JSON.stringify(v);
    for (const secret of ["420000", "SECRET SUPPLIER", "INTERNAL", "commission", "costPrice", "totalCost", "passport"]) expect(json).not.toContain(secret);
    expect(v?.money).toEqual({ total: 600000, paid: 0, balance: 600000 });
    expect(v?.store.primary).toBe("#0f766e");
  });

  it("is only reachable with the right token, on the right store, for an active store with the app", async () => {
    expect(await loadProposal("wander", "short")).toBeNull();
    expect(await loadProposal("other-store", TOKEN)).toBeNull();
    m.tripFind.mockResolvedValue(null); expect(await loadProposal("wander", TOKEN)).toBeNull();
    m.tripFind.mockResolvedValue(row({ store: { ...row().store, status: "SUSPENDED" } })); expect(await loadProposal("wander", TOKEN)).toBeNull();
    m.tripFind.mockResolvedValue(row()); m.entitlement.mockResolvedValue({ allowed: true, installed: false }); expect(await loadProposal("wander", TOKEN)).toBeNull();
  });

  it("offers no payment before acceptance, then deposit / next instalment / balance after", async () => {
    expect((await loadProposal("wander", TOKEN))?.payOptions).toEqual([]);
    m.tripFind.mockResolvedValue(row({ acceptedAt: new Date(), acceptedName: "Ada Obi", payments: [{ id: "d1", amount: "200000", status: "DUE", dueDate: new Date("2027-02-01"), paidAt: null, refundedAmount: "0" }] }));
    const v = await loadProposal("wander", TOKEN);
    expect(v?.payOptions.map((o) => [o.id, o.amount])).toEqual([["deposit", 180000], ["next", 200000], ["balance", 600000]]);
  });

  it("drops the deposit option once the deposit is paid, and all options when fully paid or expired", async () => {
    m.tripFind.mockResolvedValue(row({ acceptedAt: new Date(), payments: [{ id: "p1", amount: "180000", status: "RECEIVED", dueDate: null, paidAt: new Date(), refundedAmount: "0" }] }));
    expect((await loadProposal("wander", TOKEN))?.payOptions.map((o) => o.id)).toEqual(["balance"]);
    m.tripFind.mockResolvedValue(row({ acceptedAt: new Date(), payments: [{ id: "p1", amount: "600000", status: "RECEIVED", dueDate: null, paidAt: new Date(), refundedAmount: "0" }] }));
    expect((await loadProposal("wander", TOKEN))?.payOptions).toEqual([]);
    m.tripFind.mockResolvedValue(row({ status: "CANCELLED", acceptedAt: new Date() }));
    expect((await loadProposal("wander", TOKEN))?.payOptions).toEqual([]);
  });

  it("marks an unaccepted proposal past its expiry as expired, but not an accepted one", async () => {
    m.tripFind.mockResolvedValue(row({ proposalValidUntil: new Date("2020-01-01") }));
    expect((await loadProposal("wander", TOKEN))?.trip.expired).toBe(true);
    m.tripFind.mockResolvedValue(row({ proposalValidUntil: new Date("2020-01-01"), acceptedAt: new Date() }));
    expect((await loadProposal("wander", TOKEN))?.trip.expired).toBe(false);
  });

  it("offers no online options when the currency can't be charged", async () => {
    m.online.mockResolvedValue("Online payment isn't available for USD.");
    m.tripFind.mockResolvedValue(row({ acceptedAt: new Date() }));
    const v = await loadProposal("wander", TOKEN);
    expect(v?.payOptions).toEqual([]);
    expect(v?.onlineError).toMatch(/USD/);
  });
});

describe("flight details on the proposal", () => {
  const flight = { airline: "Emirates", flightNumber: "EK783", origin: "LOS", destination: "DXB", departAt: "2027-06-01T08:30", arriveAt: "2027-06-01T19:45", pnr: "X7K2PQ", baggage: "2 x 23kg", tickets: [{ name: "Ada Obi", number: "176-1234567890" }] };
  const withFlight = (over: Record<string, unknown> = {}) => row({ ...over, items: [{ kind: "FLIGHT", description: "Lagos–Dubai", startDate: null, endDate: null, status: "CONFIRMED", sellPrice: "600000", flightDetails: flight, ticketingDeadline: new Date("2027-05-01"), costPrice: "1" }] });
  it("shows route, times and baggage before acceptance, but not the booking reference or tickets", async () => {
    m.tripFind.mockResolvedValue(withFlight());
    const json = JSON.stringify(await loadProposal("wander", TOKEN));
    expect(json).toContain("Emirates EK783");
    expect(json).toContain("Baggage: 2 x 23kg");
    for (const secret of ["X7K2PQ", "1234567890", "ticketingDeadline"]) expect(json).not.toContain(secret);
  });
  it("adds the booking reference and tickets once accepted, never the ticketing deadline", async () => {
    m.tripFind.mockResolvedValue(withFlight({ acceptedAt: new Date(), acceptedName: "Ada Obi" }));
    const v = await loadProposal("wander", TOKEN);
    const json = JSON.stringify(v);
    expect(json).toContain("Booking ref: X7K2PQ");
    expect(json).toContain("Ticket Ada Obi: 176-1234567890");
    expect(json).not.toContain("ticketingDeadline");
  });
  it("selects no ticketing deadline from the database", async () => {
    m.tripFind.mockResolvedValue(withFlight());
    await loadProposal("wander", TOKEN);
    expect(JSON.stringify(m.tripFind.mock.calls[0][0].include.items.select)).not.toContain("ticketingDeadline");
  });
});

describe("tokens and keys", () => {
  it("share tokens are long, URL-safe and unique", () => {
    const a = newShareToken(), b = newShareToken();
    expect(a).not.toBe(b);
    expect(TOKEN_RE.test(a)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
  it("hashes partner keys deterministically without keeping the key", () => {
    expect(hashPartnerKey("tpk_abc")).toBe(hashPartnerKey("tpk_abc"));
    expect(hashPartnerKey("tpk_abc")).not.toContain("abc");
    expect(hashPartnerKey("a")).not.toBe(hashPartnerKey("b"));
  });
});
