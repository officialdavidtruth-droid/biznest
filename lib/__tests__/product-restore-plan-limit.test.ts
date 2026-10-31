import { beforeEach, describe, expect, it, vi } from "vitest";

// Publishing an archived product restores it and takes a plan slot again. Archived
// products don't count toward the limit, so without this check a store at its cap could
// archive, create more, then restore everything.

const limit = vi.fn();
const productUpdate = vi.fn();
const state = { archivedAt: null as Date | null, isPublished: false };

const makeTx = () => ({
  product: {
    findFirst: vi.fn(async () => ({ id: "p1", hasVariants: false, archivedAt: state.archivedAt, isPublished: state.isPublished, inventory: { id: "i1", quantity: 3, autoUnpublished: false, costPrice: null } })),
    update: (...a: unknown[]) => productUpdate(...a),
  },
  inventoryItem: { updateMany: vi.fn(async () => ({ count: 1 })), findUnique: vi.fn() },
  stockMovement: { create: vi.fn(async () => ({ id: "m1" })) },
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findFirst: vi.fn() },
    product: { findFirst: vi.fn(async () => ({ id: "p1", hasVariants: false, price: 5000, isPublished: state.isPublished, currency: "NGN", archivedAt: state.archivedAt })) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(makeTx())),
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/entitlements", () => ({ assertUnderPlanLimit: (...a: unknown[]) => limit(...a) }));
vi.mock("@/lib/catalog-identifiers", () => ({ findIdentifierClash: vi.fn(async () => null), clashResult: vi.fn() }));
vi.mock("@/lib/inventory-fifo", () => ({ createFifoBatchTx: vi.fn(), recordBatchLedgerForQuantityChangeTx: vi.fn() }));

import { updateProduct } from "@/lib/actions/product";

const input = (isPublished: boolean) => ({
  name: "Tote bag", type: "PHYSICAL" as const, description: "A sturdy canvas tote bag",
  price: 5000, currency: "NGN", images: [], isPublished, quantity: 3,
});

beforeEach(() => {
  vi.clearAllMocks();
  limit.mockResolvedValue({ allowed: true });
  Object.assign(state, { archivedAt: new Date("2026-01-01"), isPublished: false });
});

describe("updateProduct restoring an archived product", () => {
  it("is blocked when the store is at its plan limit", async () => {
    limit.mockResolvedValue({ allowed: false, error: "You've reached your Starter plan's limit of 3 products." });
    const r = await updateProduct("shop", "p1", input(true), { baselineQuantity: 3 });
    expect(r).toEqual({ success: false, error: "You've reached your Starter plan's limit of 3 products." });
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it("goes through, and clears archivedAt, when there is room", async () => {
    const r = await updateProduct("shop", "p1", input(true), { baselineQuantity: 3 });
    expect(r.success).toBe(true);
    expect(productUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isPublished: true, archivedAt: null }) }));
  });

  it("does not check the limit when an archived product is saved as a draft", async () => {
    limit.mockResolvedValue({ allowed: false, error: "full" });
    const r = await updateProduct("shop", "p1", input(false), { baselineQuantity: 3 });
    expect(r.success).toBe(true);
    expect(limit).not.toHaveBeenCalled();
  });

  it("does not check the limit for a normal (non-archived) edit", async () => {
    Object.assign(state, { archivedAt: null, isPublished: true });
    await updateProduct("shop", "p1", input(true), { baselineQuantity: 3 });
    expect(limit).not.toHaveBeenCalled();
  });
});
