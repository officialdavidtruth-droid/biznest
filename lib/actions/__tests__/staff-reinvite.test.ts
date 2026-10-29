import { beforeEach, describe, expect, it, vi } from "vitest";

type Staff = { id: string; storeId: string; status: string; username: string | null; invitedEmail: string | null; invitedName: string | null; userId: string | null; role: string };
type User = { id: string; email: string; role: string; passwordHash: string | null };

let staff: Staff[] = [];
let users: User[] = [];
let businesses: { userId: string }[] = [];
const logged: { action: string; target?: string }[] = [];

const matchStr = (v: string | null, f: { equals: string } | string | undefined) =>
  f === undefined ? true : typeof f === "string" ? v === f : v?.toLowerCase() === f.equals.toLowerCase();

const db: any = {
  store: { findUnique: vi.fn(async () => ({ id: "s1", slug: "shop", name: "Shop", business: { userId: "owner" } })) },
  storeStaff: {
    count: vi.fn(async () => staff.filter((x) => x.status !== "REVOKED").length),
    findFirst: vi.fn(async ({ where }: any) =>
      staff.find((x) => (where.id ? x.id === where.id : true) && (where.storeId ? x.storeId === where.storeId : true) && (where.username ? matchStr(x.username, where.username) : true) &&
        (where.invitedEmail ? matchStr(x.invitedEmail, where.invitedEmail) : true) && (where.status?.in ? where.status.in.includes(x.status) : true)) ?? null),
    findMany: vi.fn(async ({ where }: any) =>
      staff.filter((x) => x.status === where.status && x.storeId === where.storeId &&
        where.OR.some((c: any) => (c.username ? matchStr(x.username, c.username) : matchStr(x.invitedEmail, c.invitedEmail))))),
    update: vi.fn(async ({ where, data }: any) => Object.assign(staff.find((x) => x.id === where.id)!, data)),
    create: vi.fn(async ({ data }: any) => {
      if (staff.some((x) => x.storeId === data.storeId && x.username !== null && x.username === data.username)) throw new Error("unique");
      const row = { id: `st${staff.length + 1}`, invitedName: null, invitedEmail: null, ...data } as Staff;
      staff.push(row);
      return row;
    }),
  },
  user: {
    findFirst: vi.fn(async ({ where }: any) => users.find((u) => u.email === where.email) ?? null),
    findUnique: vi.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
    create: vi.fn(async ({ data }: any) => {
      const u = { id: `u${users.length + 1}`, ...data } as User;
      users.push(u);
      return u;
    }),
    update: vi.fn(async ({ where, data }: any) => Object.assign(users.find((u) => u.id === where.id)!, data)),
  },
  storePlugin: { findMany: vi.fn(async () => []) },
  business: { count: vi.fn(async ({ where }: any) => businesses.filter((b) => b.userId === where.userId).length) },
  $transaction: vi.fn(async (fn: any) => fn(db)),
};

// vi.mock is hoisted above `db`; resolve it lazily through globalThis.
(globalThis as any).__staffTestDb = db;
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_t, k) => (globalThis as any).__staffTestDb[k] }) }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "owner", role: "STORE_OWNER", name: "Owner", email: "o@x.co" } }) }));
vi.mock("@/lib/access/store-access", () => ({ getStoreAccessRole: async () => "OWNER", canManageBillingAndStaff: () => true }));
vi.mock("@/lib/access/available-staff-permissions", () => ({ getAvailableStaffPermissions: async () => [{ id: "orders" }] }));
vi.mock("@/lib/email/send", () => ({ sendStaffInviteEmail: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/notify", () => ({ notifyUser: vi.fn(async () => {}) }));
vi.mock("@/lib/activity-log", () => ({ logStoreActivity: async (p: any) => { logged.push({ action: p.action, target: p.target }); } }));
const rateAllowed = { value: true };
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: rateAllowed.value }) }));
vi.mock("@prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error { code = "X"; } } }));
vi.mock("bcryptjs", () => ({ default: { hash: async () => "hash" } }));
vi.mock("nanoid", () => ({ nanoid: () => `tok${Math.random()}` }));

import { inviteStaffMember, revokeStaffMember, updateStaffAccess } from "../staff";

const invite = (username: string, email?: string) => inviteStaffMember("shop", username, "password1", "STAFF", "Amaka", "Cashier", ["orders"], email);

beforeEach(() => {
  rateAllowed.value = true;
  staff = [];
  users = [];
  businesses = [];
  logged.length = 0;
});

describe("revoke then re-invite", () => {
  it("can re-invite the same username after revoke", async () => {
    expect((await invite("amaka")).success).toBe(true);
    await revokeStaffMember("shop", staff[0].id);
    expect(staff[0].username).toBeNull();
    const again = await invite("amaka");
    expect(again.success).toBe(true);
    expect(staff.filter((x) => x.status === "ACTIVE")).toHaveLength(1);
  });

  it("can re-invite the same real email after revoke", async () => {
    expect((await invite("amaka", "amaka@mail.com")).success).toBe(true);
    await revokeStaffMember("shop", staff[0].id);
    const again = await invite("amaka2", "amaka@mail.com");
    expect(again.success).toBe(true);
  });

  it("disables the revoked login so the old password stops working", async () => {
    await invite("amaka", "amaka@mail.com");
    await revokeStaffMember("shop", staff[0].id);
    expect(users[0].passwordHash).toBeNull();
    expect(users[0].email).toBe(`revoked.${staff[0].id}@internal.biznest`);
  });

  it("cleans up rows that were revoked before this fix", async () => {
    await invite("amaka");
    staff[0].status = "REVOKED"; // legacy revoke: identifiers still held
    expect((await invite("amaka")).success).toBe(true);
  });

  it("still rejects a username held by an ACTIVE staff member", async () => {
    await invite("amaka");
    const clash = await invite("amaka");
    expect(clash.success).toBe(false);
  });

  it("never disables a user who owns a business", async () => {
    await invite("amaka");
    businesses.push({ userId: users[0].id });
    await revokeStaffMember("shop", staff[0].id);
    expect(users[0].passwordHash).toBe("hash");
  });

  it("logs the removal with the username, before it is released", async () => {
    await invite("amaka");
    await revokeStaffMember("shop", staff[0].id);
    expect(logged.find((l) => l.action === "staff.removed")?.target).toBe("amaka");
  });

  it("revoking twice is a no-op", async () => {
    await invite("amaka");
    await revokeStaffMember("shop", staff[0].id);
    const second = await revokeStaffMember("shop", staff[0].id);
    expect(second.success).toBe(true);
    expect(logged.filter((l) => l.action === "staff.removed")).toHaveLength(1);
  });
});

describe("login email is never the invited real email", () => {
  it("creates the account under the internal placeholder, real email stays on the staff row", async () => {
    await invite("amaka", "Real.Person@Mail.com");
    expect(users[0].email).toBe("amaka.shop.staff@internal.biznest");
    expect(staff[0].invitedEmail).toBe("real.person@mail.com");
    expect(users.some((u) => u.email.includes("real.person"))).toBe(false);
  });

  it("does not collide with an existing real account on that email", async () => {
    users.push({ id: "u0", email: "real.person@mail.com", role: "CUSTOMER", passwordHash: "x" });
    expect((await invite("amaka", "real.person@mail.com")).success).toBe(true);
    expect(users.find((u) => u.id === "u0")!.passwordHash).toBe("x");
  });

  it("rejects the same email invited twice while active", async () => {
    await invite("amaka", "a@mail.com");
    expect((await invite("amaka2", "A@mail.com")).success).toBe(false);
  });
});

describe("limits", () => {
  it("rate limits invite, update and revoke", async () => {
    rateAllowed.value = false;
    expect((await invite("amaka")).success).toBe(false);
    expect((await revokeStaffMember("shop", "x")).success).toBe(false);
    expect((await updateStaffAccess("shop", "x", "STAFF", ["orders"])).success).toBe(false);
  });

  it("caps name, position and password length (bcrypt 72 bytes)", async () => {
    expect((await inviteStaffMember("shop", "amaka", "password1", "STAFF", "n".repeat(101), "Cashier", ["orders"])).success).toBe(false);
    expect((await inviteStaffMember("shop", "amaka", "password1", "STAFF", "Amaka", "p".repeat(61), ["orders"])).success).toBe(false);
    expect((await inviteStaffMember("shop", "amaka", "x".repeat(73), "STAFF", "Amaka", "Cashier", ["orders"])).success).toBe(false);
    // 40 four-byte characters = 160 bytes but only 40 chars: bytes must be counted.
    expect((await inviteStaffMember("shop", "amaka", "😀".repeat(20), "STAFF", "Amaka", "Cashier", ["orders"])).success).toBe(false);
    expect(staff).toHaveLength(0);
  });

  it("enforces the 20-staff cap inside the creating transaction", async () => {
    for (let i = 0; i < 20; i++) staff.push({ id: `x${i}`, storeId: "s1", status: "ACTIVE", username: `u${i}`, invitedEmail: null, invitedName: null, userId: null, role: "STAFF" });
    const r = await invite("amaka");
    expect(r.success).toBe(false);
    expect(users).toHaveLength(0);
  });

  it("leaves no orphan account when the staff insert fails", async () => {
    db.storeStaff.create.mockImplementationOnce(async () => { throw new Error("boom"); });
    // the mock transaction has no rollback, so emulate it: remove users created in a failed tx
    const before = users.length;
    db.$transaction.mockImplementationOnce(async (fn: any) => {
      const snapshot = [...users];
      try { return await fn(db); } catch (e) { users = snapshot; throw e; }
    });
    await expect(invite("amaka")).rejects.toThrow("boom");
    expect(users.length).toBe(before);
  });
});
