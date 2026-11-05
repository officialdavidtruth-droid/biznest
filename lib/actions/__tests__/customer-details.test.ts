import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ perm: vi.fn(), updMany: vi.fn(), ctx: vi.fn(), userFind: vi.fn(), userUpdate: vi.fn(), profUpdate: vi.fn(), ensure: vi.fn(), rate: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFind, update: m.userUpdate }, storeCustomerProfile: { update: m.profUpdate, updateMany: m.updMany } } }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.perm }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/store-customer", () => ({ requireStoreCustomer: m.ctx, requireStoreCustomerByStoreId: vi.fn() }));
vi.mock("@/lib/customer-profile-store", () => ({ ensureAccountProfile: m.ensure }));
vi.mock("@/lib/notifications/notify", () => ({ notifyStoreOfCustomerMessage: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate }));

import { updateStoreCustomerDetails } from "@/lib/actions/account";
import { saveCustomerNotes } from "@/lib/actions/customers";

beforeEach(() => {
  vi.clearAllMocks();
  m.ctx.mockResolvedValue({ userId: "u1", storeId: "s1", store: { id: "s1" } });
  m.userFind.mockResolvedValue({ email: "a@x.com" });
  m.ensure.mockResolvedValue({ id: "p1", created: false });
  m.rate.mockResolvedValue({ allowed: true });
});

describe("updateStoreCustomerDetails", () => {
  it("requires a customer account for the store", async () => {
    m.ctx.mockResolvedValue(null);
    expect((await updateStoreCustomerDetails("shop", { name: "Ada" })).success).toBe(false);
    expect(m.userUpdate).not.toHaveBeenCalled();
  });
  it("rejects short names and junk phones", async () => {
    expect((await updateStoreCustomerDetails("shop", { name: "A" })).success).toBe(false);
    expect((await updateStoreCustomerDetails("shop", { name: "Ada Obi", phone: "call me maybe" })).success).toBe(false);
    expect(m.profUpdate).not.toHaveBeenCalled();
  });
  it("saves a canonical phone on the profile and the account", async () => {
    const r = await updateStoreCustomerDetails("shop", { name: "  Ada Obi ", phone: "0803 123 4567" });
    expect(r.success).toBe(true);
    expect(m.profUpdate).toHaveBeenCalledWith({ where: { id: "p1" }, data: { name: "Ada Obi", phone: "+2348031234567" }, select: { id: true } });
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Ada Obi", phone: "+2348031234567" }, select: { id: true } });
  });
  it("refuses a phone that already belongs to another profile and leaves the account untouched", async () => {
    m.profUpdate.mockRejectedValue({ code: "P2002" });
    const r = await updateStoreCustomerDetails("shop", { name: "Ada Obi", phone: "08031234567" });
    expect(r.success).toBe(false);
    expect(m.userUpdate).not.toHaveBeenCalled();
  });
});

describe("saveCustomerNotes", () => {
  it("is limited to this store's profiles and the customers permission", async () => {
    m.perm.mockResolvedValue({ success: true, store: { id: "storeA" } });
    m.updMany.mockResolvedValue({ count: 1 });
    expect((await saveCustomerNotes("shop", "p9", " Likes size M ")).success).toBe(true);
    expect(m.updMany).toHaveBeenCalledWith({ where: { id: "p9", storeId: "storeA" }, data: { notes: "Likes size M" } });
  });
  it("reports a profile from another store as not found", async () => {
    m.perm.mockResolvedValue({ success: true, store: { id: "storeA" } });
    m.updMany.mockResolvedValue({ count: 0 });
    expect((await saveCustomerNotes("shop", "other", "x")).success).toBe(false);
  });
  it("rejects staff without access", async () => {
    m.perm.mockResolvedValue({ success: false, error: "Forbidden" });
    expect(await saveCustomerNotes("shop", "p9", "x")).toEqual({ success: false, error: "Forbidden" });
    expect(m.updMany).not.toHaveBeenCalled();
  });
});
