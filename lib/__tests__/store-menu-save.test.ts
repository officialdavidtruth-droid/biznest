import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: string; storeId: string; location: string; label: string; linkType: string; target: string | null; openInNewTab: boolean; parentId: string | null; sortOrder: number; isActive: boolean };

// vi.mock factories are hoisted above imports, so the fake database must be created with vi.hoisted too.
const db = vi.hoisted(() => {
  const state = { rows: [] as Row[], nextId: 1 };
  const items = {
    findMany: async ({ where }: any) => state.rows.filter((r) => r.storeId === where.storeId && r.location === where.location),
    create: async ({ data }: any) => { const r = { id: `new${state.nextId++}`, isActive: true, ...data } as Row; state.rows.push(r); return { id: r.id }; },
    update: async ({ where, data }: any) => { Object.assign(state.rows.find((r) => r.id === where.id)!, data); return {}; },
    deleteMany: async ({ where }: any) => {
      const doomed = new Set(state.rows.filter((r) => r.storeId === where.storeId && r.location === where.location && !where.id.notIn.includes(r.id)).map((r) => r.id));
      // mimic onDelete: Cascade on the parent relation
      let grew = true;
      while (grew) { grew = false; for (const r of state.rows) if (r.parentId && doomed.has(r.parentId) && !doomed.has(r.id)) { doomed.add(r.id); grew = true; } }
      state.rows = state.rows.filter((r) => !doomed.has(r.id));
      return {};
    },
  };
  return { state, items };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findMany: async () => [{ id: "c1" }] },
    storePage: { findMany: async () => [] },
    store: { findUnique: async () => ({ businessType: null, business: { category: null }, template: { name: null } }) },
    storeMenuItem: db.items,
    $transaction: async (fn: any) => fn({ storeMenuItem: db.items }),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: async () => ({ success: true, role: "OWNER", store: { id: "s1", name: "Acme" } }) }));
vi.mock("@/lib/storefront/page-blocks", () => ({ hasPageContent: () => true }));
vi.mock("@/lib/store-pages", () => ({ filterAvailablePages: (o: unknown) => o, isStorePageAvailable: () => true }));

import { saveStoreMenu } from "../actions/store-menu";

const seed = (): Row[] => [
  { id: "a", storeId: "s1", location: "header", label: "Home", linkType: "PAGE", target: "/", openInNewTab: false, parentId: null, sortOrder: 0, isActive: true },
  { id: "b", storeId: "s1", location: "header", label: "Shop", linkType: "CATEGORY", target: "c1", openInNewTab: false, parentId: null, sortOrder: 1, isActive: true },
  { id: "c", storeId: "s1", location: "header", label: "Sale", linkType: "PAGE", target: "/offers", openInNewTab: false, parentId: "b", sortOrder: 2, isActive: true },
  { id: "x", storeId: "OTHER", location: "header", label: "Not mine", linkType: "PAGE", target: "/", openInNewTab: false, parentId: null, sortOrder: 0, isActive: true },
];

beforeEach(() => { db.state.rows = seed(); db.state.nextId = 1; });

describe("saveStoreMenu updates in place", () => {
  it("keeps ids of kept items, inserts only new ones, deletes only removed ones", async () => {
    const res = await saveStoreMenu("acme", [
      { id: "a", label: "Home page", linkType: "PAGE", target: "/" },
      { id: "b", label: "Shop", linkType: "CATEGORY", target: "c1", children: [{ id: "c", label: "Sale", linkType: "PAGE", target: "/offers" }, { label: "New", linkType: "PAGE", target: "/contact" }] },
    ]);
    expect(res.success).toBe(true);
    const mine = db.state.rows.filter((r) => r.storeId === "s1");
    expect(mine.map((r) => r.id).sort()).toEqual(["a", "b", "c", "new1"]);
    expect(db.state.rows.find((r) => r.id === "a")!.label).toBe("Home page");
    expect(db.state.rows.find((r) => r.id === "new1")!.parentId).toBe("b");
    expect(db.state.rows.find((r) => r.id === "x")).toBeTruthy(); // another store's item untouched
  });

  it("deletes items the owner removed", async () => {
    await saveStoreMenu("acme", [{ id: "a", label: "Home", linkType: "PAGE", target: "/" }]);
    expect(db.state.rows.filter((r) => r.storeId === "s1").map((r) => r.id)).toEqual(["a"]);
  });

  it("promoting a dropdown child to top level survives removing its old parent", async () => {
    await saveStoreMenu("acme", [{ id: "a", label: "Home", linkType: "PAGE", target: "/" }, { id: "c", label: "Sale", linkType: "PAGE", target: "/offers" }]);
    const c = db.state.rows.find((r) => r.id === "c")!;
    expect(c).toBeTruthy();
    expect(c.parentId).toBeNull();
    expect(db.state.rows.find((r) => r.id === "b")).toBeUndefined();
  });

  it("ignores unknown or foreign ids and never claims one id twice", async () => {
    await saveStoreMenu("acme", [
      { id: "x", label: "Hijack", linkType: "PAGE", target: "/" },
      { id: "a", label: "One", linkType: "PAGE", target: "/" },
      { id: "a", label: "Two", linkType: "PAGE", target: "/about" },
    ]);
    expect(db.state.rows.find((r) => r.id === "x")!.label).toBe("Not mine");
    const mine = db.state.rows.filter((r) => r.storeId === "s1");
    expect(mine).toHaveLength(3);
    expect(mine.filter((r) => r.id === "a")).toHaveLength(1);
  });

  it("returns the saved tree with ids so a second save keeps updating the same rows", async () => {
    const first = await saveStoreMenu("acme", [{ label: "Fresh", linkType: "PAGE", target: "/about" }]);
    if (!first.success) throw new Error("save failed");
    const id = first.data[0].id!;
    await saveStoreMenu("acme", [{ id, label: "Fresh 2", linkType: "PAGE", target: "/about" }]);
    expect(db.state.rows.filter((r) => r.storeId === "s1")).toHaveLength(1);
    expect(db.state.rows.find((r) => r.id === id)!.label).toBe("Fresh 2");
  });

  it("sort order follows the order sent and items come back active", async () => {
    db.state.rows.find((r) => r.id === "b")!.isActive = false;
    await saveStoreMenu("acme", [{ id: "b", label: "Shop", linkType: "CATEGORY", target: "c1" }, { id: "a", label: "Home", linkType: "PAGE", target: "/" }]);
    expect(db.state.rows.find((r) => r.id === "b")!.sortOrder).toBe(0);
    expect(db.state.rows.find((r) => r.id === "a")!.sortOrder).toBe(1);
    expect(db.state.rows.find((r) => r.id === "b")!.isActive).toBe(true);
  });
});
