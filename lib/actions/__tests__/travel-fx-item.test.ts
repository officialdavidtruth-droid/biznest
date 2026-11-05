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
const base = { kind: "HOTEL", description: "Atlantis, 4 nights", costPrice: 0, sellPrice: 2_500_000 };

beforeEach(() => {
  vi.clearAllMocks();
  m.perm.mockResolvedValue({ success: true, store });
  m.entitlement.mockResolvedValue({ allowed: true, installed: true });
  m.tripFind.mockResolvedValue({ id: "t1", status: "QUOTED", totalPrice: "0", totalCost: "0", currency: "NGN" });
  m.itemFindMany.mockResolvedValue([]);
});

describe("supplier price in another currency", () => {
  it("converts at the entered rate and keeps the original price and rate on the line", async () => {
    const r = await saveTravelItem("wander", "t1", { ...base, costCurrency: "USD", costAmount: 1200, fxRate: 1550.5 });
    expect(r.success).toBe(true);
    expect(m.itemCreate.mock.calls[0][0].data).toMatchObject({ costPrice: 1_860_600, costCurrency: "USD", costAmount: 1200, fxRate: 1550.5, sellPrice: 2_500_000 });
  });

  it("needs both the supplier price and a rate", async () => {
    expect((await saveTravelItem("wander", "t1", { ...base, costCurrency: "USD", costAmount: 1200 })).success).toBe(false);
    expect((await saveTravelItem("wander", "t1", { ...base, costCurrency: "USD", fxRate: 1550 })).success).toBe(false);
    expect((await saveTravelItem("wander", "t1", { ...base, costCurrency: "US", costAmount: 10, fxRate: 1 })).success).toBe(false);
    expect(m.itemCreate).not.toHaveBeenCalled();
  });

  it("ignores a 'foreign' currency equal to the trip's own and clears old conversion data", async () => {
    const r = await saveTravelItem("wander", "t1", { ...base, costPrice: 900_000, costCurrency: "NGN", costAmount: 5, fxRate: 5 });
    expect(r.success).toBe(true);
    expect(m.itemCreate.mock.calls[0][0].data).toMatchObject({ costPrice: 900_000, costCurrency: null, costAmount: null, fxRate: null });
  });

  it("leaves ordinary lines untouched", async () => {
    await saveTravelItem("wander", "t1", { ...base, costPrice: 700_000 });
    expect(m.itemCreate.mock.calls[0][0].data).toMatchObject({ costPrice: 700_000, costCurrency: null });
  });
});
