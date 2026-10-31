import { beforeEach, describe, expect, it, vi } from "vitest";

// Removing an option value deactivates its variants; a variant still holding
// stock must block that, or the stock silently drops out of every total.

const s = { qty: 4 };
const txUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findFirst: vi.fn(async () => ({ id: "p1", name: "Tee", hasVariants: true, inventory: null, variantOptions: [{ name: "Size", values: ["S", "M"] }] })) },
    productVariant: {
      findMany: vi.fn(async () => [
        { id: "vS", label: "S", optionValues: { Size: "S" }, isActive: true, quantity: 0 },
        { id: "vM", label: "M", optionValues: { Size: "M" }, isActive: true, quantity: s.qty },
      ]),
    },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn({
      productVariant: { count: vi.fn(async () => s.qty > 0 ? 1 : 0), updateMany: (...a: unknown[]) => txUpdateMany(...a), createMany: vi.fn(), update: vi.fn() },
      product: { update: vi.fn() },
      inventoryItem: { findUnique: vi.fn() },
    })),
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({
  assertStorePermission: vi.fn(async () => ({ success: true, role: "OWNER", store: { id: "s1", slug: "shop" } })),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("@/lib/activity-log", () => ({ logStoreActivity: vi.fn() }));
vi.mock("@/lib/webhooks/dispatch", () => ({ emitWebhookEvent: vi.fn() }));
vi.mock("@/lib/catalog-identifiers", () => ({ findIdentifierClash: vi.fn(), clashResult: vi.fn() }));
vi.mock("@/lib/inventory-fifo", () => ({ consumeFifoStockTx: vi.fn(), createFifoBatchTx: vi.fn() }));
vi.mock("@prisma/client", () => ({ Prisma: { DbNull: "DbNull" } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { setVariantOptions } from "@/lib/actions/variant";

beforeEach(() => { vi.clearAllMocks(); s.qty = 4; });

describe("setVariantOptions stock guard", () => {
  it("refuses to drop an option value whose variant still has stock", async () => {
    const r = await setVariantOptions("shop", "p1", [{ name: "Size", values: ["S"] }]);
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toMatch(/still has stock/);
    expect(txUpdateMany).not.toHaveBeenCalled();
  });

  it("allows it once the variant's stock is zero", async () => {
    s.qty = 0;
    const r = await setVariantOptions("shop", "p1", [{ name: "Size", values: ["S"] }]);
    expect(r.success).toBe(true);
  });
});
