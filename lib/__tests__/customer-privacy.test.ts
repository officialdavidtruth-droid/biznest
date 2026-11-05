import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const m = vi.hoisted(() => {
  const tx = {
    storeWallet: { findFirst: vi.fn(), update: vi.fn() },
    order: { findMany: vi.fn(), update: vi.fn() },
    booking: { updateMany: vi.fn() },
    storeCustomerAddress: { deleteMany: vi.fn() }, wishlistItem: { deleteMany: vi.fn() }, pushSubscription: { deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() }, storeCustomerProfile: { deleteMany: vi.fn() }, review: { updateMany: vi.fn() },
    user: { update: vi.fn() },
  };
  return { tx, userFind: vi.fn(), orderCount: vi.fn(), bookingCount: vi.fn(), transaction: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: m.userFind }, order: { count: m.orderCount }, booking: { count: m.bookingCount }, $transaction: m.transaction },
}));

import { deleteStoreCustomerAccount } from "@/lib/customer-privacy";

let hash: string;
beforeEach(async () => {
  vi.clearAllMocks();
  hash = await bcrypt.hash("secret-pass", 4);
  m.userFind.mockResolvedValue({ id: "u1", role: "CUSTOMER", customerScopeStoreId: "s1", passwordHash: hash });
  m.orderCount.mockResolvedValue(0);
  m.bookingCount.mockResolvedValue(0);
  m.tx.storeWallet.findFirst.mockResolvedValue(null);
  m.tx.order.findMany.mockResolvedValue([]);
  m.transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
});

describe("deleteStoreCustomerAccount", () => {
  it("refuses owners, staff and accounts of another store", async () => {
    m.userFind.mockResolvedValue({ id: "u1", role: "STORE_OWNER", customerScopeStoreId: null, passwordHash: hash });
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(false);
    m.userFind.mockResolvedValue({ id: "u1", role: "CUSTOMER", customerScopeStoreId: "other", passwordHash: hash });
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(false);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("needs the right password", async () => {
    expect((await deleteStoreCustomerAccount("u1", "s1", "wrong")).success).toBe(false);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it.each([
    ["an order in progress", () => m.orderCount.mockResolvedValue(1)],
    ["an upcoming booking", () => m.bookingCount.mockResolvedValue(1)],
  ])("blocks deletion while there is %s", async (_n, setup) => {
    setup();
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(false);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("blocks deletion while the wallet holds money, checked inside the transaction, and deletes nothing", async () => {
    m.tx.storeWallet.findFirst.mockResolvedValue({ id: "w1", balance: 500, currency: "NGN" });
    const r = await deleteStoreCustomerAccount("u1", "s1", "secret-pass");
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toMatch(/wallet balance/);
    expect(r.success === false && r.error).not.toMatch(/withdraw/i);
    expect(m.tx.user.update).not.toHaveBeenCalled();
    expect(m.tx.storeWallet.update).not.toHaveBeenCalled();
  });
  it("closes an empty wallet so a late top-up can't land in a deleted account", async () => {
    m.tx.storeWallet.findFirst.mockResolvedValue({ id: "w1", balance: 0, currency: "NGN" });
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(true);
    expect(m.tx.storeWallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CLOSED" } }));
  });
  it("blanks the delivery name, phone and street on finished orders but keeps the area", async () => {
    m.tx.order.findMany.mockResolvedValue([{ id: "o1", shippingAddress: { fullName: "Ada", phone: "0803", address: "5 Road", city: "Lagos", state: "Lagos", country: "Nigeria" } }]);
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(true);
    expect(m.tx.order.update.mock.calls[0][0].data.shippingAddress).toEqual({ fullName: "Deleted customer", phone: "", address: "", city: "Lagos", state: "Lagos", country: "Nigeria" });
    expect(m.tx.order.findMany.mock.calls[0][0].where.status.in).not.toContain("PAID");
  });
  it("anonymises the account when everything is settled", async () => {
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(true);
    expect(m.tx.user.update.mock.calls[0][0].data).toMatchObject({ name: "Deleted customer", email: "deleted-u1@deleted.invalid", phone: null, isBanned: true });
  });
});
