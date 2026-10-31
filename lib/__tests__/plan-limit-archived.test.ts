import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { assertUnderPlanLimit } from "@/lib/entitlements";

// Archived products (kept only for order/stock history) must not use up plan slots.
describe("assertUnderPlanLimit and archived products", () => {
  it("counts only non-archived products against the limit", async () => {
    const count = vi.fn(async () => 2);
    const db = {
      store: { findUnique: vi.fn(async () => ({ subscription: { name: "Starter", features: { products: 3 } } })) },
      product: { count },
      service: { count: vi.fn() },
    } as never;
    const r = await assertUnderPlanLimit("s1", "products", db);
    expect(r.allowed).toBe(true);
    expect(count).toHaveBeenCalledWith({ where: { storeId: "s1", archivedAt: null } });
  });

  it("still blocks when live products reach the limit", async () => {
    const db = {
      store: { findUnique: vi.fn(async () => ({ subscription: { name: "Starter", features: { products: 3 } } })) },
      product: { count: vi.fn(async () => 3) },
      service: { count: vi.fn() },
    } as never;
    expect((await assertUnderPlanLimit("s1", "products", db)).allowed).toBe(false);
  });
});
