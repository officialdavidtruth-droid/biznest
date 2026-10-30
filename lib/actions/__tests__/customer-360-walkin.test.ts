import { beforeEach, describe, expect, it, vi } from "vitest";

const profiles = vi.fn();
const orders = vi.fn();
const bookings = vi.fn();
const folioTotals = vi.fn();
const guests = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storeCustomerProfile: { findMany: (...a: unknown[]) => profiles(...a) },
    order: { findMany: (...a: unknown[]) => orders(...a) },
    booking: { findMany: (...a: unknown[]) => bookings(...a) },
    propertyFolioCharge: { groupBy: (...a: unknown[]) => folioTotals(...a) },
    propertyGuest: { findMany: (...a: unknown[]) => guests(...a) },
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
import { assertStorePermission } from "@/lib/access/assert-store-access";

const WALKIN = "pos-walkin-s1@biznest.internal";
const order = (id: string, total: number, buyer: { email: string; name: string; phone?: string | null }, extra: Record<string, unknown> = {}) => ({
  id, buyerId: buyer.email === WALKIN ? "walkin-user" : "user-" + id, total, currency: "NGN", channel: "POS", status: "COMPLETED",
  createdAt: new Date("2026-10-01"), posCustomerName: null, posCustomerPhone: null, customerProfileId: null,
  buyer: { phone: null, ...buyer }, items: [], ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  bookings.mockResolvedValue([]);
  folioTotals.mockResolvedValue([]);
  guests.mockResolvedValue([]);
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

describe("getCustomer360 refunds and disputes", () => {
  it("keeps refunded/disputed orders in the history but out of every metric", async () => {
    profiles.mockResolvedValue([]);
    const item = { quantity: 1, unitPrice: 999, product: { name: "Refunded thing" }, service: null };
    orders.mockResolvedValue([
      order("o1", 5000, { email: "ada@example.com", name: "Ada" }, { channel: "ONLINE", status: "COMPLETED", createdAt: new Date("2026-10-05") }),
      order("o2", 3000, { email: "ada@example.com", name: "Ada" }, { channel: "ONLINE", status: "REFUNDED", createdAt: new Date("2026-10-20"), items: [item] }),
      order("o3", 2000, { email: "ada@example.com", name: "Ada" }, { channel: "POS", status: "DISPUTED", createdAt: new Date("2026-10-25") }),
      order("w1", 700, { email: WALKIN, name: "Walk-in customer" }, { status: "REFUNDED" }),
    ]);
    const r = await getCustomer360("shop");
    const ada = r.customers[0];
    expect(ada.spent).toBe(5000);
    expect(ada.orders).toBe(1);
    expect(ada.averageOrder).toBe(5000);
    expect(ada.onlineOrders).toBe(1);
    expect(ada.posOrders).toBe(0);
    expect(ada.lastPurchase).toBe(new Date("2026-10-05").toISOString());
    expect(ada.topProducts).toHaveLength(0);
    expect(ada.ordersList).toHaveLength(3); // history stays complete
    expect(r.walkIn).toEqual({ orders: 0, spent: 0 });
  });

  it("still lists a customer whose only orders were refunded", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([order("o1", 4000, { email: "bola@example.com", name: "Bola" }, { channel: "ONLINE", status: "REFUNDED" })]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].spent).toBe(0);
    expect(r.customers[0].orders).toBe(0);
  });
});

describe("getCustomer360 hotel guests", () => {
  const charge = (id: string, amount: number, status = "PAID", postedAt = "2026-10-10") => ({
    id, description: "Room service", category: "F&B", amount, currency: "NGN", status,
    reservationId: "r-" + id, reservation: { room: { name: "101" } }, postedAt: new Date(postedAt),
  });
  const guest = (id: string, fullName: string, extra: Record<string, unknown> = {}, folioCharges: ReturnType<typeof charge>[] = []) =>
    ({ id, fullName, email: null, phone: null, notes: null, folioCharges, ...extra });
  const totals = (guestId: string, status: string, amount: number) => ({ guestId, status, _sum: { amount } });

  it("does not attach a guest's charges to a profile that only shares their name", async () => {
    profiles.mockResolvedValue([{ id: "p1", userId: null, name: "Chioma Okafor", email: "chioma@example.com", phone: null, notes: null }]);
    orders.mockResolvedValue([]);
    folioTotals.mockResolvedValue([totals("g1", "PAID", 1000)]);
    guests.mockResolvedValue([guest("g1", "Chioma Okafor", { email: "other.chioma@example.com" }, [charge("c1", 1000)])]);
    const r = await getCustomer360("shop");
    const profile = r.customers.find((c) => c.profileId === "p1")!;
    expect(profile.bills).toHaveLength(0);
    expect(profile.roomChargesPaid).toBe(0);
    expect(r.customers.filter((c) => c.bills.length === 1)).toHaveLength(1);
  });

  it("still links a guest to a profile by email or phone", async () => {
    profiles.mockResolvedValue([{ id: "p1", userId: null, name: "Chioma Okafor", email: null, phone: "+2348031234567", notes: null }]);
    orders.mockResolvedValue([]);
    folioTotals.mockResolvedValue([totals("g1", "PAID", 1000)]);
    guests.mockResolvedValue([guest("g1", "C. Okafor", { phone: "0803 123 4567" }, [charge("c1", 1000)])]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].profileId).toBe("p1");
    expect(r.customers[0].bills).toHaveLength(1);
  });

  it("reports paid and open room charges separately and keeps them out of order metrics", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([order("o1", 4000, { email: "ada@example.com", name: "Ada" }, { channel: "ONLINE" })]);
    folioTotals.mockResolvedValue([totals("g1", "PAID", 25000), totals("g1", "OPEN", 8000)]);
    guests.mockResolvedValue([guest("g1", "Ada", { email: "ada@example.com" }, [charge("c1", 25000), charge("c2", 8000, "OPEN")])]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    const ada = r.customers[0];
    expect(ada.roomChargesPaid).toBe(25000);
    expect(ada.roomChargesOpen).toBe(8000);
    expect(ada.spent).toBe(4000); // orders only
    expect(ada.averageOrder).toBe(4000);
  });

  it("excludes void charges from the totals query and skips the guest query when there is no PMS data", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([]);
    await getCustomer360("shop");
    expect(folioTotals.mock.calls[0][0].where.status).toEqual({ not: "VOID" });
    expect(guests).not.toHaveBeenCalled();
  });

  it("caps each guest's listed charges at 30 in the query, not store-wide", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([]);
    folioTotals.mockResolvedValue([totals("g1", "PAID", 1)]);
    guests.mockResolvedValue([guest("g1", "Ada", { email: "a@x.com" }, [charge("c1", 1)])]);
    await getCustomer360("shop");
    const args = guests.mock.calls[0][0];
    expect(args.select.folioCharges.take).toBe(30);
    expect(args.select.folioCharges.where.status).toEqual({ not: "VOID" });
    expect(args.take).toBeUndefined();
  });
});

describe("getCustomer360 service bookings", () => {
  const booking = (id: string, extra: Record<string, unknown> = {}) => ({
    id, referenceCode: null, buyerId: null, status: "COMPLETED", paymentStatus: "PAID", paymentAmount: 15000, paymentCurrency: "NGN",
    createdAt: new Date("2026-10-10"), guestName: null, guestPhone: null, guestEmail: null,
    service: { name: "Haircut" }, buyer: null, ...extra,
  });

  it("shows a service business's clients and counts paid bookings as revenue", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([]);
    bookings.mockResolvedValue([
      booking("b1", { guestName: "Ngozi", guestEmail: "ngozi@example.com", createdAt: new Date("2026-10-01") }),
      booking("b2", { guestName: "Ngozi", guestEmail: "NGOZI@example.com", paymentAmount: 5000, createdAt: new Date("2026-10-15") }),
    ]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    const c = r.customers[0];
    expect(c.name).toBe("Ngozi");
    expect(c.spent).toBe(20000);
    expect(c.orders).toBe(2);
    expect(c.bookingCount).toBe(2);
    expect(c.averageOrder).toBe(10000);
    expect(c.lastPurchase).toBe(new Date("2026-10-15").toISOString());
    expect(c.topProducts[0]).toEqual({ name: "Haircut", quantity: 2, revenue: 20000 });
    expect(c.ordersList[0].channel).toBe("BOOKING");
  });

  it("lists unpaid, pending, refunded and cancelled bookings without counting them", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([]);
    bookings.mockResolvedValue([
      booking("b1", { guestEmail: "a@x.com", paymentStatus: "UNPAID" }),
      booking("b2", { guestEmail: "a@x.com", paymentStatus: "PENDING" }),
      booking("b3", { guestEmail: "a@x.com", paymentStatus: "REFUNDED" }),
      booking("b4", { guestEmail: "a@x.com", status: "CANCELLED" }),
    ]);
    const c = (await getCustomer360("shop")).customers[0];
    expect(c.spent).toBe(0);
    expect(c.orders).toBe(0);
    expect(c.bookingCount).toBe(0);
    expect(c.ordersList).toHaveLength(4);
  });

  it("merges a customer's bookings with their orders and profile by email or phone", async () => {
    profiles.mockResolvedValue([{ id: "p1", userId: null, name: "Chika", email: null, phone: "+2348031234567", notes: null }]);
    orders.mockResolvedValue([order("o1", 4000, { email: "x@example.com", name: "Buyer", phone: "08031234567" }, { channel: "ONLINE" })]);
    bookings.mockResolvedValue([booking("b1", { guestPhone: "0803 123 4567", guestName: "Chika" })]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].profileId).toBe("p1");
    expect(r.customers[0].spent).toBe(19000);
    expect(r.customers[0].orders).toBe(2);
  });

  it("keeps a booking with no contact details as its own row and sorts mixed history newest first", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([order("o1", 1000, { email: "ada@example.com", name: "Ada" }, { channel: "ONLINE", createdAt: new Date("2026-10-01") })]);
    bookings.mockResolvedValue([
      booking("b1", { buyerId: "user-o1", buyer: { name: "Ada", email: "ada@example.com", phone: null }, createdAt: new Date("2026-10-20") }),
      booking("b2", { guestName: "Anonymous guest" }),
    ]);
    const r = await getCustomer360("shop");
    expect(r.customers).toHaveLength(2);
    const ada = r.customers.find((c) => c.email === "ada@example.com")!;
    expect(ada.ordersList.map((o) => o.channel)).toEqual(["BOOKING", "ONLINE"]);
  });
});

describe("getCustomer360 currency", () => {
  const asStore = (store: Record<string, unknown>) =>
    vi.mocked(assertStorePermission).mockResolvedValueOnce({ success: true, role: "OWNER", store: { id: "s1", slug: "shop", business: { sellsProducts: true, offersServices: false }, ...store } } as never);

  it("defaults to NGN and reports no mixed currencies for a normal store", async () => {
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([order("o1", 1000, { email: "a@x.com", name: "A" })]);
    const r = await getCustomer360("shop");
    expect(r.currency).toBe("NGN");
    expect(r.locale).toBeNull();
    expect(r.mixedCurrencies).toBeNull();
  });

  it("passes the store's own currency and locale through so non-NGN stores are not shown in naira", async () => {
    asStore({ currency: "GHS", locale: "en-GH" });
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([order("o1", 1000, { email: "a@x.com", name: "A" }, { currency: "GHS" })]);
    const r = await getCustomer360("shop");
    expect(r.currency).toBe("GHS");
    expect(r.locale).toBe("en-GH");
    expect(r.mixedCurrencies).toBeNull();
  });

  it("flags counted orders or bookings recorded in a currency other than the store's", async () => {
    asStore({ currency: "GHS" });
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([order("o1", 1000, { email: "a@x.com", name: "A" }, { currency: "NGN" })]);
    const r = await getCustomer360("shop");
    expect(r.mixedCurrencies).toEqual(["GHS", "NGN"]);
  });

  it("does not let a refunded order in another currency trigger the warning", async () => {
    asStore({ currency: "GHS" });
    profiles.mockResolvedValue([]);
    orders.mockResolvedValue([
      order("o1", 1000, { email: "a@x.com", name: "A" }, { currency: "GHS" }),
      order("o2", 500, { email: "a@x.com", name: "A" }, { currency: "NGN", status: "REFUNDED" }),
    ]);
    expect((await getCustomer360("shop")).mixedCurrencies).toBeNull();
  });
});
