import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  perm: vi.fn(), entitlement: vi.fn(), tripFind: vi.fn(), clientFind: vi.fn(), storeFind: vi.fn(), charge: vi.fn(), tripUpdate: vi.fn(), paymentCreate: vi.fn(),
  refund: vi.fn(), tpFind: vi.fn(), tpUpdateMany: vi.fn(), payFind: vi.fn(),
}));

vi.mock("@prisma/client", () => ({ Prisma: { DbNull: "DB_NULL" } }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    travelTrip: { findFirst: m.tripFind, update: m.tripUpdate },
    travelClient: { findFirst: m.clientFind },
    travelPayment: { create: m.paymentCreate, findFirst: m.tpFind, updateMany: m.tpUpdateMany },
    payment: { findFirst: m.payFind },
    store: { findUnique: m.storeFind },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.perm }));
vi.mock("@/lib/plugins", () => ({ getPluginEntitlement: m.entitlement }));
vi.mock("@/lib/payments/travel-charge", () => ({ startTravelCharge: m.charge, travelOnlinePaymentError: vi.fn(async (_s: string, cur: string) => (cur === "NGN" ? null : "Online payment isn't available.")) }));
vi.mock("@/lib/payments/refund-travel", () => ({ refundTravelPayment: m.refund }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "owner@wander.test" } }) }));

import { createTravelPaymentLink, createTravelTrip, recordTravelPayment, requestTravelRefund, voidTravelPayment } from "@/lib/actions/travel";

const storeA = { id: "storeA", currency: "NGN", businessType: "Travel & Tourism", business: { category: "Travel & Tourism" } };
const trip = (over: Record<string, unknown> = {}) => ({ id: "trip1", status: "CONFIRMED", currency: "NGN", totalPrice: "200000", totalCost: "0", payments: [], client: { fullName: "Ada", email: "a@x.com" }, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  m.perm.mockResolvedValue({ success: true, store: storeA });
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
  m.storeFind.mockResolvedValue({ id: "storeA", slug: "wander", customDomain: null, customDomainStatus: "NONE" });
  m.charge.mockResolvedValue({ success: true, url: "https://pay.example/x" });
});

describe("travel admin actions are store scoped and gated", () => {
  it("rejects staff without the plugin permission", async () => {
    m.perm.mockResolvedValue({ success: false, error: "Forbidden" });
    expect(await createTravelPaymentLink("wander", "trip1", 1000)).toEqual({ success: false, error: "Forbidden" });
  });

  it("rejects stores that have not installed the app, or are not travel businesses", async () => {
    m.entitlement.mockResolvedValue({ allowed: true, installed: false });
    expect((await createTravelPaymentLink("wander", "trip1", 1000)).success).toBe(false);
    m.entitlement.mockResolvedValue({ allowed: true, installed: true });
    m.perm.mockResolvedValue({ success: true, store: { ...storeA, businessType: "Retail", business: { category: "Retail" } } });
    expect((await createTravelPaymentLink("wander", "trip1", 1000)).success).toBe(false);
  });

  it("cannot reach another store's trip: lookups always filter by the caller's store", async () => {
    m.tripFind.mockResolvedValue(null);
    expect(await createTravelPaymentLink("wander", "tripOfStoreB", 1000)).toEqual({ success: false, error: "Trip not found." });
    expect(m.tripFind.mock.calls[0][0].where).toMatchObject({ id: "tripOfStoreB", storeId: "storeA" });
    expect(m.charge).not.toHaveBeenCalled();
    expect((await recordTravelPayment("wander", "tripOfStoreB", { amount: 10, method: "CASH" })).success).toBe(false);
    expect(m.paymentCreate).not.toHaveBeenCalled();
  });

  it("cannot create a trip for another store's client", async () => {
    m.clientFind.mockResolvedValue(null);
    const r = await createTravelTrip("wander", { clientId: "clientOfStoreB", title: "x", destination: "Paris" });
    expect(r.success).toBe(false);
    expect(m.clientFind.mock.calls[0][0].where).toMatchObject({ id: "clientOfStoreB", storeId: "storeA" });
  });
});

describe("createTravelPaymentLink", () => {
  it("creates a link for an amount within the balance", async () => {
    m.tripFind.mockResolvedValue(trip({ payments: [{ amount: "50000", status: "RECEIVED" }] }));
    const r = await createTravelPaymentLink("wander", "trip1", 100000);
    expect(r).toEqual({ success: true, data: { url: "https://pay.example/x" } });
    expect(m.charge.mock.calls[0][0]).toMatchObject({ tripId: "trip1", amountNaira: 100000 });
  });

  it("refuses more than the balance, zero, non-NGN trips, unpriced trips and closed trips", async () => {
    m.tripFind.mockResolvedValue(trip({ payments: [{ amount: "150000", status: "RECEIVED" }] }));
    expect((await createTravelPaymentLink("wander", "trip1", 60000)).success).toBe(false); // balance is 50,000
    expect((await createTravelPaymentLink("wander", "trip1", 0)).success).toBe(false);
    m.tripFind.mockResolvedValue(trip({ currency: "USD" }));
    expect((await createTravelPaymentLink("wander", "trip1", 1000)).success).toBe(false);
    m.tripFind.mockResolvedValue(trip({ totalPrice: "0" }));
    expect((await createTravelPaymentLink("wander", "trip1", 1000)).success).toBe(false);
    m.tripFind.mockResolvedValue(trip({ status: "CANCELLED" }));
    expect((await createTravelPaymentLink("wander", "trip1", 1000)).success).toBe(false);
    expect(m.charge).not.toHaveBeenCalled();
  });
});

describe("requestTravelRefund", () => {
  it("is gated by the plugin permission and never reaches the refund code without it", async () => {
    m.perm.mockResolvedValue({ success: false, error: "Forbidden" });
    expect(await requestTravelRefund("wander", "trip1", "tp1", { amount: 100, reason: "x" })).toEqual({ success: false, error: "Forbidden" });
    expect(m.refund).not.toHaveBeenCalled();
  });

  it("passes the caller's own store and email to the refund code", async () => {
    m.refund.mockResolvedValue({ success: true, data: { mode: "gateway", amount: 100, full: false } });
    await requestTravelRefund("wander", "trip1", "tp1", { amount: 100, reason: "Visa refused" });
    expect(m.refund.mock.calls[0][0]).toMatchObject({ store: { id: "storeA" }, actorEmail: "owner@wander.test", tripId: "trip1", travelPaymentId: "tp1", amount: 100, reason: "Visa refused" });
  });
});

describe("voidTravelPayment", () => {
  it("refuses to void money that was taken online (it must be refunded instead)", async () => {
    m.tripFind.mockResolvedValue(trip());
    m.tpFind.mockResolvedValue({ reference: "TVL-trip1-abc", status: "RECEIVED", refundedAmount: "0" });
    m.payFind.mockResolvedValue({ id: "pay1" });
    const r = await voidTravelPayment("wander", "trip1", "tp1");
    expect(r.success).toBe(false);
    expect(m.tpUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses to void a refunded payment", async () => {
    m.tripFind.mockResolvedValue(trip());
    m.tpFind.mockResolvedValue({ reference: null, status: "RECEIVED", refundedAmount: "50000" });
    expect((await voidTravelPayment("wander", "trip1", "tp1")).success).toBe(false);
    expect(m.tpUpdateMany).not.toHaveBeenCalled();
  });

  it("still voids a manual entry made by mistake", async () => {
    m.tripFind.mockResolvedValue(trip());
    m.tpFind.mockResolvedValue({ reference: null, status: "RECEIVED", refundedAmount: "0" });
    m.tpUpdateMany.mockResolvedValue({ count: 1 });
    expect((await voidTravelPayment("wander", "trip1", "tp1")).success).toBe(true);
    expect(m.tpUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: "tp1", tripId: "trip1" }, data: { status: "VOID" } });
  });
});
