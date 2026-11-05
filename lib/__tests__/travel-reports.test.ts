import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ trips: vi.fn(), dues: vi.fn(), pays: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { travelTrip: { findMany: m.trips }, travelPayment: { findMany: (a: { where: { status: unknown } }) => (a.where.status === "DUE" ? m.dues(a) : m.pays(a)) } } }));

import { buildTravelReports, profitCsv, receivablesCsv, paymentsCsv } from "@/lib/travel-reports";

const NOW = new Date("2027-05-01T00:00:00Z");
const trip = (over: Record<string, unknown> = {}) => ({
  id: "t1", reference: "TRV-1", title: "Dubai", destination: "Dubai", status: "CONFIRMED", currency: "NGN", departDate: new Date("2027-06-01"),
  totalPrice: "1000000", totalCost: "700000", commissionRate: "10", commissionBasis: "SELL", client: { fullName: "Ada Obi" }, agent: { name: "Tunde" },
  payments: [{ amount: "400000", status: "RECEIVED", refundedAmount: "0" }], ...over,
});

beforeEach(() => { vi.clearAllMocks(); m.trips.mockResolvedValue([trip()]); m.dues.mockResolvedValue([]); m.pays.mockResolvedValue([]); });

describe("buildTravelReports", () => {
  it("profit is price less supplier cost and earned agent commission", async () => {
    const r = await buildTravelReports("storeA", NOW);
    expect(r.rows[0]).toMatchObject({ price: 1_000_000, cost: 700_000, commission: 100_000, profit: 200_000, marginPct: 20, paid: 400_000, balance: 600_000 });
    expect(r.totals).toEqual([expect.objectContaining({ currency: "NGN", profit: 200_000, trips: 1 })]);
  });

  it("keeps currencies apart instead of adding naira to dollars", async () => {
    m.trips.mockResolvedValue([trip(), trip({ id: "t2", reference: "TRV-2", currency: "USD", totalPrice: "2000", totalCost: "1500", commissionRate: "0" })]);
    const r = await buildTravelReports("storeA", NOW);
    expect(r.totals.map((t) => [t.currency, t.profit]).sort()).toEqual([["NGN", 200_000], ["USD", 500]]);
  });

  it("scopes every query to the store and ignores cancelled/enquiry trips", async () => {
    await buildTravelReports("storeA", NOW);
    expect(m.trips.mock.calls[0][0].where).toMatchObject({ storeId: "storeA" });
    expect(m.trips.mock.calls[0][0].where.status.in).not.toContain("CANCELLED");
    expect(m.trips.mock.calls[0][0].where.status.in).not.toContain("ENQUIRY");
    expect(m.dues.mock.calls[0][0].where.trip).toMatchObject({ storeId: "storeA" });
  });

  it("ages instalments into buckets", async () => {
    const d = (id: string, daysAgo: number) => ({ id, amount: "100000", dueDate: new Date(NOW.getTime() - daysAgo * 86_400_000), trip: { id: "t1", reference: "TRV-1", currency: "NGN", client: { fullName: "Ada Obi", phone: "0803", email: null } } });
    m.dues.mockResolvedValue([d("a", -5), d("b", 10), d("c", 45), d("d", 120)]);
    const r = await buildTravelReports("storeA", NOW);
    expect(r.aging.map((a) => [a.bucket, a.count])).toEqual([["CURRENT", 1], ["1-30", 1], ["31-60", 1], ["61-90", 0], ["90+", 1]]);
    expect(r.receivables.find((x) => x.paymentId === "d")?.daysOverdue).toBe(120);
  });
});

describe("csv exports", () => {
  it("neutralises spreadsheet formulas in client-controlled text", async () => {
    m.trips.mockResolvedValue([trip({ client: { fullName: "=HYPERLINK(\"http://evil\")" }, title: "+cmd" })]);
    const csv = profitCsv(await buildTravelReports("storeA", NOW));
    expect(csv).toContain("'=HYPERLINK");
    expect(csv.split("\n")[0]).toContain("Profit");
  });
  it("receivables and payments exports have the right headers and rows", async () => {
    m.dues.mockResolvedValue([{ id: "a", amount: "100000", dueDate: new Date("2027-04-01"), trip: { id: "t1", reference: "TRV-1", currency: "NGN", client: { fullName: "Ada", phone: "0803", email: "a@x.com" } } }]);
    expect(receivablesCsv(await buildTravelReports("storeA", NOW))).toContain("TRV-1,Ada,0803,a@x.com,NGN,100000,2027-04-01,30,1-30");
    m.pays.mockResolvedValue([{ paidAt: new Date("2027-03-02"), amount: "50000", refundedAmount: "5000", method: "TRANSFER", reference: "R1", trip: { reference: "TRV-1", title: "Dubai", currency: "NGN", client: { fullName: "Ada" } } }]);
    const csv = await paymentsCsv("storeA");
    expect(csv).toContain("2027-03-02,TRV-1,Ada,Dubai,NGN,50000,5000,45000,TRANSFER,R1");
    expect(m.pays.mock.calls[0][0].where.trip).toMatchObject({ storeId: "storeA" });
  });
});
