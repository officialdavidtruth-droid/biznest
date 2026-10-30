import { beforeEach, describe, expect, it, vi } from "vitest";

const profiles = vi.fn();
const orders = vi.fn();
const folio = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storeCustomerProfile: { findMany: (...a: unknown[]) => profiles(...a) },
    order: { findMany: (...a: unknown[]) => orders(...a) },
    propertyFolioCharge: { findMany: (...a: unknown[]) => folio(...a) },
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({
    success: true,
    role: "OWNER",
    store: { id: "s1", slug: "shop", business: { sellsProducts: true, offersServices: false } },
  })),
}));

import { getCustomer360 } from "@/lib/actions/customers";

const WALKIN = "pos-walkin-s1@biznest.internal";
const order = (id: string, total: number, buyer: { email: string; name: string; phone?: string | null }, extra: Record<string, unknown> = {}) => ({
  id, buyerId: buyer.email === WALKIN ? "walkin-user" : "user-" + id, total, currency: "NGN", channel: "POS", status: "COMPLETED",
  createdAt: new Date("2026-10-01"), posCustomerName: null, posCustomerPhone: null, customerProfileId: null,
  buyer: { phone: null, ...buyer }, items: [], ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  folio.mockResolvedValue([]);
});

describe("getCustomer360 walk-in sales", () => {
  it("keeps anonymous POS sales out of the customer list and reports them separately", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([
      order("o1", 1000, { email: WALKIN, name: "Walk-in customer" }),
      order("o2", 2500, { email: WALKIN, name: "Walk-in customer" }),
      order("o3", 4000, { email: "ada@example.com", name: "Ada" }, { channel: "ONLINE" }),
    ]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].email).toBe("ada@example.com");
    expect(r.walkIn).toEqual({ orders: 2, spent: 3500 });
  });

  it("never exposes the internal walk-in email or user id on a named POS customer", async () => {
    profiles.mockResolvedValue([{ id: "p1", userId: null, name: "Chika", email: null, phone: "08031234567", notes: null }]);
    orders.mockResolvedValue([order("o1", 1500, { email: WALKIN, name: "Walk-in customer" }, { customerProfileId: "p1" })]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].name).toBe("Chika");
    expect(r.customers[0].email).toBeNull();
    expect(r.customers[0].userId).toBeNull();
    expect(r.walkIn.orders).toBe(0);
  });

  it("treats 0803… and +234803… as the same person for an order matched only by phone", async () => {
    profiles.mockResolvedValue([{ id: "p1", userId: null, name: "Chika", email: null, phone: "+2348031234567", notes: null }]);
    orders.mockResolvedValue([
      order("o1", 1000, { email: "x1@example.com", name: "Buyer", phone: "0803 123 4567" }, { channel: "ONLINE" }),
    ]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].profileId).toBe("p1");
    expect(r.customers[0].orders).toBe(1);
  });
});
