import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  perm: vi.fn(), entitlement: vi.fn(), tripFind: vi.fn(), tripUpdate: vi.fn(), payFind: vi.fn(), payUpdateMany: vi.fn(), payCreate: vi.fn(), tx: vi.fn(),
  setFind: vi.fn(), setUpsert: vi.fn(), pkgFind: vi.fn(), depFindMany: vi.fn(), depFirst: vi.fn(), depCreate: vi.fn(), depUpdateMany: vi.fn(), depDelete: vi.fn(), depUpdate: vi.fn(), travCount: vi.fn(), email: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    travelTrip: { findFirst: m.tripFind, update: m.tripUpdate },
    travelPayment: { findMany: m.payFind, updateMany: m.payUpdateMany, create: m.payCreate },
    travelSettings: { findUnique: m.setFind, upsert: m.setUpsert, updateMany: vi.fn() },
    travelPackage: { findFirst: m.pkgFind },
    travelDeparture: { findMany: m.depFindMany, findFirst: m.depFirst, create: m.depCreate, updateMany: m.depUpdateMany, delete: m.depDelete, update: m.depUpdate },
    travelTraveler: { count: m.travCount },
    $transaction: m.tx,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/payments/travel-charge", () => ({ travelOnlinePaymentError: vi.fn(async () => null) }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.perm }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/email/send", () => ({ sendOrderNotificationEmail: m.email, storeEmailBrand: (s: { name: string }) => ({ name: s.name }) }));
vi.mock("@/lib/travel-reports", () => ({ buildTravelReports: vi.fn() }));

import { createTravelInstalmentPlan, saveTravelDeparture, removeTravelDeparture, shareTravelProposal, unshareTravelProposal, emailTravelProposal, rotateTravelPartnerKey, saveTravelSettings } from "@/lib/actions/travel-growth";

const storeA = { id: "storeA", currency: "NGN", businessType: "Travel & Tourism", business: { category: "Travel & Tourism" } };
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const trip = (over: Record<string, unknown> = {}) => ({
  id: "trip1", title: "Dubai", destination: "Dubai", totalCost: "0", status: "CONFIRMED", currency: "NGN", totalPrice: "600000", departDate: null, shareToken: null, termsText: null, acceptedAt: null, proposalSentAt: null,
  payments: [], client: { fullName: "Ada Obi", email: "ada@x.com" },
  store: { id: "storeA", slug: "wander", name: "Wander", logoUrl: null, themeColors: null, contactEmail: null, contactPhone: null, customDomain: null, customDomainStatus: "NONE" }, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.perm.mockResolvedValue({ success: true, store: storeA });
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
  m.tx.mockResolvedValue([]);
  m.payFind.mockResolvedValue([]);
  m.setFind.mockResolvedValue(null);
  m.email.mockResolvedValue({ data: {}, error: null });
});

describe("access", () => {
  it("every growth action is gated like the rest of the travel workspace", async () => {
    m.perm.mockResolvedValue({ success: false, error: "Forbidden" });
    expect((await saveTravelSettings("wander", {})).success).toBe(false);
    expect((await rotateTravelPartnerKey("wander")).success).toBe(false);
    expect((await shareTravelProposal("wander", "trip1", {})).success).toBe(false);
    expect(m.setUpsert).not.toHaveBeenCalled();
    expect(m.tripUpdate).not.toHaveBeenCalled();
  });
});

describe("createTravelInstalmentPlan", () => {
  it("replaces unpaid instalments with a plan that adds up to the balance", async () => {
    m.tripFind.mockResolvedValue(trip({ payments: [{ amount: "100000", status: "RECEIVED", refundedAmount: "0" }] }));
    const r = await createTravelInstalmentPlan("wander", "trip1", { count: 3, firstDue: future(10), intervalDays: 30 });
    expect(r).toEqual({ success: true, data: { created: 3 } });
    expect(m.tripFind.mock.calls[0][0].where).toMatchObject({ id: "trip1", storeId: "storeA" });
    const ops = m.tx.mock.calls[0][0];
    expect(ops).toHaveLength(4); // 1 void + 3 creates
    const created = m.payCreate.mock.calls.map((c) => Number(c[0].data.amount));
    expect(created.reduce((a, b) => a + b, 0)).toBe(500000); // 600,000 price − 100,000 paid
    expect(m.payCreate.mock.calls[0][0].data).toMatchObject({ status: "DUE", tripId: "trip1" });
    expect(m.payUpdateMany.mock.calls[0][0]).toMatchObject({ where: { tripId: "trip1", status: "DUE" }, data: { status: "VOID" } });
  });

  it("refuses closed trips, no balance, past dates and plans running past departure", async () => {
    m.tripFind.mockResolvedValue(trip({ status: "CANCELLED" }));
    expect((await createTravelInstalmentPlan("wander", "trip1", { count: 2, firstDue: future(5), intervalDays: 7 })).success).toBe(false);
    m.tripFind.mockResolvedValue(trip({ payments: [{ amount: "600000", status: "RECEIVED", refundedAmount: "0" }] }));
    expect((await createTravelInstalmentPlan("wander", "trip1", { count: 2, firstDue: future(5), intervalDays: 7 })).success).toBe(false);
    m.tripFind.mockResolvedValue(trip());
    expect((await createTravelInstalmentPlan("wander", "trip1", { count: 2, firstDue: "2020-01-01", intervalDays: 7 })).success).toBe(false);
    m.tripFind.mockResolvedValue(trip({ departDate: new Date(Date.now() + 20 * 86_400_000) }));
    const late = await createTravelInstalmentPlan("wander", "trip1", { count: 3, firstDue: future(5), intervalDays: 30 });
    expect(late.success).toBe(false);
    expect(m.tx).not.toHaveBeenCalled();
  });
});

describe("saveTravelDeparture", () => {
  beforeEach(() => { m.pkgFind.mockResolvedValue({ id: "pkg1", departureDate: new Date(`${future(30)}T00:00:00Z`) }); m.depFindMany.mockResolvedValue([]); });

  it("adds a dated departure to this store's package", async () => {
    const r = await saveTravelDeparture("wander", { packageId: "pkg1", departureDate: future(90), seats: 20, cutoffDays: 14, pricePerPerson: "250000" });
    expect(r.success).toBe(true);
    expect(m.pkgFind.mock.calls[0][0].where).toMatchObject({ id: "pkg1", storeId: "storeA" });
    expect(m.depCreate.mock.calls[0][0].data).toMatchObject({ storeId: "storeA", packageId: "pkg1", seats: 20, cutoffDays: 14, pricePerPerson: 250000 });
  });

  it("rejects a duplicate of the main date, past dates and a lower seat limit than seats already held", async () => {
    const main = future(30);
    expect((await saveTravelDeparture("wander", { packageId: "pkg1", departureDate: main })).success).toBe(false);
    expect((await saveTravelDeparture("wander", { packageId: "pkg1", departureDate: "2020-01-01" })).success).toBe(false);
    m.travCount.mockResolvedValue(5);
    const r = await saveTravelDeparture("wander", { id: "dep1", packageId: "pkg1", departureDate: future(90), seats: 3 });
    expect(r.success).toBe(false);
    expect(m.depCreate).not.toHaveBeenCalled();
    expect(m.depUpdateMany).not.toHaveBeenCalled();
  });

  it("closes a departure that has bookings instead of deleting it", async () => {
    m.depFirst.mockResolvedValue({ id: "dep1", _count: { trips: 2 } });
    expect(await removeTravelDeparture("wander", "dep1")).toEqual({ success: true, data: { closed: true } });
    expect(m.depDelete).not.toHaveBeenCalled();
    m.depFirst.mockResolvedValue({ id: "dep2", _count: { trips: 0 } });
    expect(await removeTravelDeparture("wander", "dep2")).toEqual({ success: true, data: { closed: false } });
    expect(m.depDelete).toHaveBeenCalled();
  });
});

describe("proposals", () => {
  it("creates an unguessable link, copies the default terms, and moves an enquiry to quoted", async () => {
    m.tripFind.mockResolvedValue(trip({ status: "ENQUIRY" }));
    m.setFind.mockResolvedValue({ termsText: "Deposit is non-refundable." });
    const r = await shareTravelProposal("wander", "trip1", { note: "Hi", validUntil: future(14) });
    expect(r.success).toBe(true);
    const data = m.tripUpdate.mock.calls[0][0].data;
    expect(data.shareToken).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(data).toMatchObject({ termsText: "Deposit is non-refundable.", status: "QUOTED", proposalNote: "Hi" });
    if (r.success) expect(r.data.url).toContain(`/travel/p/${data.shareToken}`);
  });

  it("keeps the same link when updating, and refuses to share an unpriced or closed trip", async () => {
    m.tripFind.mockResolvedValue(trip({ shareToken: "existing-token-existing-token" }));
    await shareTravelProposal("wander", "trip1", {});
    expect(m.tripUpdate.mock.calls[0][0].data.shareToken).toBe("existing-token-existing-token");
    m.tripFind.mockResolvedValue(trip({ totalPrice: "0" }));
    expect((await shareTravelProposal("wander", "trip1", {})).success).toBe(false);
    m.tripFind.mockResolvedValue(trip({ status: "COMPLETED" }));
    expect((await shareTravelProposal("wander", "trip1", {})).success).toBe(false);
  });

  it("locks the terms once the client has accepted them", async () => {
    m.tripFind.mockResolvedValue(trip({ acceptedAt: new Date(), termsText: "Original terms" }));
    const changed = await shareTravelProposal("wander", "trip1", { terms: "Sneaky new terms" });
    expect(changed.success).toBe(false);
    expect(m.tripUpdate).not.toHaveBeenCalled();
    const same = await shareTravelProposal("wander", "trip1", { terms: "Original terms", note: "Thanks" });
    expect(same.success).toBe(true);
    expect(m.tripUpdate.mock.calls[0][0].data.termsText).toBe("Original terms");
  });

  it("turns the link off for this store's trip only", async () => {
    m.tripUpdate.mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    (await import("@/lib/prisma")).prisma.travelTrip.updateMany = updateMany;
    expect((await unshareTravelProposal("wander", "trip1")).success).toBe(true);
    expect(updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "trip1", storeId: "storeA" }, data: { shareToken: null } });
  });

  it("emails the link, and reports a failed send instead of pretending", async () => {
    m.tripFind.mockResolvedValue(trip({ shareToken: "tok-tok-tok-tok-tok-tok-1" }));
    expect((await emailTravelProposal("wander", "trip1")).success).toBe(true);
    expect(m.email.mock.calls[0][0]).toBe("ada@x.com");
    expect(m.email.mock.calls[0][2]).toContain("/travel/p/tok-tok-tok-tok-tok-tok-1");
    m.email.mockResolvedValue({ data: null, error: { message: "bounced" } });
    expect((await emailTravelProposal("wander", "trip1")).success).toBe(false);
    m.tripFind.mockResolvedValue(trip({ shareToken: "tok-tok-tok-tok-tok-tok-1", client: { fullName: "Ada", email: null } }));
    expect((await emailTravelProposal("wander", "trip1")).success).toBe(false);
  });
});

describe("partner key", () => {
  it("shows the key once and stores only its hash", async () => {
    const r = await rotateTravelPartnerKey("wander");
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.key).toMatch(/^tpk_/);
    const stored = m.setUpsert.mock.calls[0][0].update;
    expect(stored.partnerKeyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(r.data.key);
    expect(stored.partnerKeyHint).toBe(r.data.key.slice(-4));
  });
});

describe("settings", () => {
  it("validates the review link and saves defaults", async () => {
    expect((await saveTravelSettings("wander", { reviewUrl: "javascript:alert(1)" })).success).toBe(false);
    expect((await saveTravelSettings("wander", { termsText: "T&C", remindersEnabled: false, reviewUrl: "https://g.page/r/abc" })).success).toBe(true);
    expect(m.setUpsert.mock.calls[0][0].update).toMatchObject({ termsText: "T&C", remindersEnabled: false, reviewUrl: "https://g.page/r/abc" });
  });
});
