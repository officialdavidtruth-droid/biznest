import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const m = vi.hoisted(() => ({
  userFind: vi.fn(), userUpdate: vi.fn(), walletFind: vi.fn(), orderCount: vi.fn(), bookingCount: vi.fn(), tx: vi.fn(),
  del: vi.fn(), upd: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: m.userFind, update: m.userUpdate },
    storeWallet: { findFirst: m.walletFind },
    order: { count: m.orderCount },
    booking: { count: m.bookingCount, updateMany: m.upd },
    storeCustomerAddress: { deleteMany: m.del }, wishlistItem: { deleteMany: m.del }, pushSubscription: { deleteMany: m.del },
    verificationToken: { deleteMany: m.del }, storeCustomerProfile: { deleteMany: m.del }, review: { updateMany: m.upd },
    $transaction: m.tx,
  },
}));

import { deleteStoreCustomerAccount } from "@/lib/customer-privacy";

let hash: string;
beforeEach(async () => {
  vi.clearAllMocks();
  hash = await bcrypt.hash("secret-pass", 4);
  m.userFind.mockResolvedValue({ id: "u1", role: "CUSTOMER", customerScopeStoreId: "s1", passwordHash: hash });
  m.walletFind.mockResolvedValue(null);
  m.orderCount.mockResolvedValue(0);
  m.bookingCount.mockResolvedValue(0);
  m.tx.mockResolvedValue([]);
});

describe("deleteStoreCustomerAccount", () => {
  it("refuses owners, staff and accounts of another store", async () => {
    m.userFind.mockResolvedValue({ id: "u1", role: "STORE_OWNER", customerScopeStoreId: null, passwordHash: hash });
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(false);
    m.userFind.mockResolvedValue({ id: "u1", role: "CUSTOMER", customerScopeStoreId: "other", passwordHash: hash });
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(false);
    expect(m.tx).not.toHaveBeenCalled();
  });
  it("needs the right password", async () => {
    const r = await deleteStoreCustomerAccount("u1", "s1", "wrong");
    expect(r.success).toBe(false);
    expect(m.tx).not.toHaveBeenCalled();
  });
  it.each([
    ["wallet money", () => m.walletFind.mockResolvedValue({ balance: 500, currency: "NGN" })],
    ["an order in progress", () => m.orderCount.mockResolvedValue(1)],
    ["an upcoming booking", () => m.bookingCount.mockResolvedValue(1)],
  ])("blocks deletion while there is %s", async (_n, setup) => {
    setup();
    expect((await deleteStoreCustomerAccount("u1", "s1", "secret-pass")).success).toBe(false);
    expect(m.tx).not.toHaveBeenCalled();
  });
  it("anonymises the account when everything is settled", async () => {
    const r = await deleteStoreCustomerAccount("u1", "s1", "secret-pass");
    expect(r.success).toBe(true);
    expect(m.tx).toHaveBeenCalledOnce();
    const data = m.userUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: "Deleted customer", email: "deleted-u1@deleted.invalid", phone: null, isBanned: true });
  });
});
