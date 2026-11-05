import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = { storeCustomerAddress: { count: vi.fn(), updateMany: vi.fn(), create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), update: vi.fn() } };
  return {
    tx,
    requireStoreCustomer: vi.fn(),
    prisma: { $transaction: vi.fn(), storeCustomerAddress: { findFirst: vi.fn() }, user: { findUnique: vi.fn() } },
    rate: vi.fn(),
    ensure: vi.fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/store-customer", () => ({ requireStoreCustomer: m.requireStoreCustomer, requireStoreCustomerByStoreId: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));
vi.mock("@/lib/customer-profile-store", () => ({ ensureAccountProfile: m.ensure }));
vi.mock("@/lib/notifications/notify", () => ({ notifyStoreOfCustomerMessage: vi.fn() }));
vi.mock("@/lib/customer-privacy", () => ({ deleteStoreCustomerAccount: vi.fn() }));
vi.mock("@/lib/store-customer-auth", () => ({ signOutStoreCustomer: vi.fn() }));
vi.mock("@/lib/message-limits", () => ({ CUSTOMER_MESSAGE_LIMIT: 1000, validateMessageContent: vi.fn() }));

import { addStoreAddress, deleteStoreAddress, updateStoreCustomerPreferences } from "../account";

const good = { fullName: "Ada Obi", phone: "0803 000 0000", line1: "5 Allen Ave", city: "Ikeja", state: "Lagos" };

beforeEach(() => {
  vi.clearAllMocks();
  m.requireStoreCustomer.mockResolvedValue({ userId: "u1", storeId: "s1" });
  m.rate.mockResolvedValue({ allowed: true });
  m.prisma.$transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
  m.tx.storeCustomerAddress.count.mockResolvedValue(2);
  m.tx.storeCustomerAddress.create.mockResolvedValue({ id: "a1" });
});

describe("addStoreAddress", () => {
  it("stores only known fields, trimmed and capped, ignoring injected ones", async () => {
    const r = await addStoreAddress("shop", { ...good, line1: "  " + "x".repeat(500), id: "evil", userId: "victim", storeId: "other" } as any);
    expect(r.success).toBe(true);
    const data = m.tx.storeCustomerAddress.create.mock.calls[0][0].data;
    expect(data.line1.length).toBe(200);
    expect(data.userId).toBe("u1");
    expect(data.storeId).toBe("s1");
    expect(data.id).toBeUndefined();
  });
  it("makes the first address the default", async () => {
    m.tx.storeCustomerAddress.count.mockResolvedValue(0);
    await addStoreAddress("shop", good);
    expect(m.tx.storeCustomerAddress.create.mock.calls[0][0].data.isDefault).toBe(true);
  });
  it("caps saved addresses at 10", async () => {
    m.tx.storeCustomerAddress.count.mockResolvedValue(10);
    const r = await addStoreAddress("shop", good);
    expect(r.success).toBe(false);
    expect(m.tx.storeCustomerAddress.create).not.toHaveBeenCalled();
  });
  it("rejects bad phone numbers and missing fields", async () => {
    expect((await addStoreAddress("shop", { ...good, phone: "call me" })).success).toBe(false);
    expect((await addStoreAddress("shop", { ...good, city: " " })).success).toBe(false);
  });
  it("is rate limited", async () => {
    m.rate.mockResolvedValue({ allowed: false });
    expect((await addStoreAddress("shop", good)).success).toBe(false);
  });
});

describe("deleteStoreAddress", () => {
  it("promotes another address when the default is removed", async () => {
    m.prisma.storeCustomerAddress.findFirst.mockResolvedValue({ id: "a1", isDefault: true });
    m.tx.storeCustomerAddress.findFirst.mockResolvedValue({ id: "a2" });
    await deleteStoreAddress("shop", "a1");
    expect(m.tx.storeCustomerAddress.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "a2" }, data: { isDefault: true } }));
  });
  it("leaves defaults alone when a non-default is removed", async () => {
    m.prisma.storeCustomerAddress.findFirst.mockResolvedValue({ id: "a1", isDefault: false });
    await deleteStoreAddress("shop", "a1");
    expect(m.tx.storeCustomerAddress.update).not.toHaveBeenCalled();
  });
});

describe("updateStoreCustomerPreferences", () => {
  it("reports failure instead of success when an unverified email defers the profile", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ name: "A", email: "a@b.c", phone: null, emailVerified: null });
    m.ensure.mockResolvedValue({ id: "", created: false, deferred: true });
    const r = await updateStoreCustomerPreferences("shop", { a: 1 });
    expect(r.success).toBe(false);
  });
  it("succeeds when the profile is saved", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ name: "A", email: "a@b.c", phone: null, emailVerified: new Date() });
    m.ensure.mockResolvedValue({ id: "p1", created: false });
    expect((await updateStoreCustomerPreferences("shop", { a: 1 })).success).toBe(true);
  });
});
