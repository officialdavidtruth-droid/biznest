import { describe, expect, it } from "vitest";
import { ensureAccountProfile, findOrCreatePosProfile, type ProfileDb } from "@/lib/customer-profile-store";
import { planProfileMerges, type MergeableProfile } from "@/lib/customer-profile-merge";

type Row = { id: string; storeId: string; userId: string | null; name: string; email: string | null; phone: string | null; updatedAt: Date; preferences?: unknown };

/** In-memory stand-in that enforces the same unique rules as the migration. */
function fakeDb(seed: Row[] = [], users: { id: string; email: string }[] = []) {
  const rows = [...seed];
  let n = 0;
  let beforeCreate: (() => void) | null = null;
  const dupe = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  const violates = (r: Partial<Row>, selfId?: string) =>
    rows.some((x) => x.id !== selfId && x.storeId === (r.storeId ?? x.storeId) && (
      (r.email && x.email?.toLowerCase() === r.email.toLowerCase()) || (r.phone && x.phone === r.phone) || (r.userId && x.userId === r.userId)));
  const matches = (r: Row, w: any): boolean => {
    if (w.storeId && r.storeId !== w.storeId) return false;
    if (w.userId && r.userId !== w.userId) return false;
    if (w.id?.not && r.id === w.id.not) return false;
    if (w.email && r.email?.toLowerCase() !== String(w.email).toLowerCase()) return false;
    if (w.OR && !w.OR.some((c: any) => (c.email ? r.email === c.email : c.phone ? c.phone.in.includes(r.phone) : false))) return false;
    return true;
  };
  const db: ProfileDb = {
    storeCustomerProfile: {
      findMany: async ({ where }) => rows.filter((r) => matches(r, where)),
      findFirst: async ({ where }) => rows.find((r) => matches(r, where)) ?? null,
      create: async ({ data }) => {
        beforeCreate?.(); beforeCreate = null;
        if (violates(data)) throw dupe();
        const row: Row = { id: `new${++n}`, userId: null, email: null, phone: null, updatedAt: new Date(), ...data };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const r = rows.find((x) => x.id === where.id)!;
        if (violates(data, r.id)) throw dupe();
        Object.assign(r, data);
        return r;
      },
    },
    user: { findFirst: async ({ where }) => users.find((u) => u.email === where.email) ?? null },
  };
  return { db, rows, raceOnNextCreate: (fn: () => void) => { beforeCreate = fn; } };
}
const row = (id: string, extra: Partial<Row> = {}): Row => ({ id, storeId: "s1", userId: null, name: "Ada Obi", email: null, phone: null, updatedAt: new Date("2026-01-01"), ...extra });

describe("findOrCreatePosProfile", () => {
  const input = { storeId: "s1", name: "Ada Obi", email: null, phone: "+2348031234567", phoneRaw: "08031234567" };

  it("reuses an existing profile found under a different phone format", async () => {
    const f = fakeDb([row("A", { phone: "+2348031234567" })]);
    expect(await findOrCreatePosProfile(f.db, input)).toBe("A");
    expect(f.rows).toHaveLength(1);
  });
  it("creates once, then reuses on the next sale", async () => {
    const f = fakeDb();
    const first = await findOrCreatePosProfile(f.db, input);
    const second = await findOrCreatePosProfile(f.db, input);
    expect(second).toBe(first);
    expect(f.rows).toHaveLength(1);
  });
  it("survives losing a create race: finds the winner instead of erroring or duplicating", async () => {
    const f = fakeDb();
    f.raceOnNextCreate(() => { f.rows.push(row("WINNER", { phone: "+2348031234567" })); }); // concurrent request commits first
    expect(await findOrCreatePosProfile(f.db, input)).toBe("WINNER");
    expect(f.rows).toHaveLength(1);
  });
  it("rethrows errors that are not unique violations", async () => {
    const f = fakeDb();
    f.db.storeCustomerProfile.create = async () => { throw new Error("db down"); };
    await expect(findOrCreatePosProfile(f.db, input)).rejects.toThrow("db down");
  });
});

describe("ensureAccountProfile", () => {
  it("links the profile a POS sale already created for the same email instead of duplicating it", async () => {
    const f = fakeDb([row("POS", { name: "ada@x.com", email: "ada@x.com" })]);
    const r = await ensureAccountProfile(f.db, { storeId: "s1", userId: "u1", name: "Ada Obi", email: "Ada@X.com" });
    expect(r).toEqual({ id: "POS", created: false });
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0].userId).toBe("u1");
    expect(f.rows[0].name).toBe("Ada Obi"); // placeholder name upgraded
  });
  it("is idempotent for an account that already has a profile, and applies preferences", async () => {
    const f = fakeDb([row("P", { userId: "u1", email: "ada@x.com" })]);
    const r = await ensureAccountProfile(f.db, { storeId: "s1", userId: "u1", name: "Ada", email: "ada@x.com", preferences: { a: 1 } });
    expect(r).toEqual({ id: "P", created: false });
    expect(f.rows[0].preferences).toEqual({ a: 1 });
  });
  it("creates a profile when none exists, and does not claim an email owned by another account", async () => {
    const f = fakeDb([row("OTHER", { userId: "u9", email: "ada@x.com" })]);
    const r = await ensureAccountProfile(f.db, { storeId: "s1", userId: "u1", name: "Ada", email: "ada@x.com" });
    expect(r.created).toBe(true);
    expect(f.rows.find((x) => x.id === r.id)!.email).toBeNull();
    expect(f.rows.find((x) => x.id === "OTHER")!.userId).toBe("u9");
  });
  it("drops a phone that already belongs to another profile instead of failing", async () => {
    const f = fakeDb([row("OTHER", { phone: "+2348031234567" })]);
    const r = await ensureAccountProfile(f.db, { storeId: "s1", userId: "u1", name: "Ada", email: "ada@x.com", phone: "0803 123 4567" });
    expect(r.created).toBe(true);
    expect(f.rows.find((x) => x.id === r.id)!.phone).toBeNull();
  });
  it("survives a concurrent create for the same account", async () => {
    const f = fakeDb();
    f.raceOnNextCreate(() => { f.rows.push(row("WINNER", { userId: "u1" })); });
    const r = await ensureAccountProfile(f.db, { storeId: "s1", userId: "u1", name: "Ada", email: null });
    expect(r.id).toBe("WINNER");
    expect(f.rows).toHaveLength(1);
  });
});

describe("planProfileMerges", () => {
  const m = (id: string, extra: Partial<MergeableProfile> = {}): MergeableProfile =>
    ({ id, storeId: "s1", userId: null, name: "Ada", email: null, phone: null, notes: null, createdAt: new Date(`2026-01-0${id.length}`), ...extra });

  it("merges profiles sharing a phone in different formats and fills blanks on the survivor", () => {
    const a = m("a", { phone: "0803 123 4567", createdAt: new Date("2026-01-01") });
    const b = m("b", { phone: "+2348031234567", email: "Ada@x.com", createdAt: new Date("2026-02-01") });
    const { plans, review } = planProfileMerges([b, a]);
    expect(review).toHaveLength(0);
    expect(plans).toEqual([{ storeId: "s1", keepId: "a", mergeIds: ["b"], patch: { phone: "+2348031234567", email: "ada@x.com" } }]);
  });
  it("chains through different keys (A~B by email, B~C by phone)", () => {
    const { plans } = planProfileMerges([m("a", { email: "x@x.com" }), m("b", { email: "x@x.com", phone: "08031234567" }), m("c", { phone: "+2348031234567" })]);
    expect(plans).toHaveLength(1);
    expect(plans[0].mergeIds).toHaveLength(2);
  });
  it("keeps the profile that has a login account", () => {
    const { plans } = planProfileMerges([m("old", { email: "x@x.com", createdAt: new Date("2026-01-01") }), m("acct", { email: "x@x.com", userId: "u1", createdAt: new Date("2026-03-01") })]);
    expect(plans[0].keepId).toBe("acct");
  });
  it("leaves ambiguous groups for manual review instead of merging", () => {
    const { plans, review } = planProfileMerges([m("a", { email: "a@x.com", phone: "08031234567" }), m("b", { email: "b@x.com", phone: "+2348031234567" })]);
    expect(plans).toHaveLength(0);
    expect(review[0].ids.sort()).toEqual(["a", "b"]);
  });
  it("never merges across stores", () => {
    const { plans } = planProfileMerges([m("a", { phone: "08031234567" }), m("b", { storeId: "s2", phone: "08031234567" })]);
    expect(plans).toHaveLength(0);
  });
});
