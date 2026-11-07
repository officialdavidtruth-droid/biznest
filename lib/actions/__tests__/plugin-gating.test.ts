import { beforeEach, describe, expect, it, vi } from "vitest";

const { entitlement, upsert } = vi.hoisted(() => ({ entitlement: vi.fn(), upsert: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u1", role: "USER" } })) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findUnique: vi.fn(async () => ({ id: "s1", slug: "shop", business: {} })) },
    storePlugin: { upsert, findUniqueOrThrow: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: vi.fn() }));
vi.mock("@/lib/access/store-access", () => ({ getStoreAccessRole: vi.fn(async () => "OWNER"), canManageBillingAndStaff: () => true }));
vi.mock("@/lib/payments/gateway", () => ({ chargeCustomer: vi.fn(), getBillingGateway: async () => "KORAPAY", billingCallbackUrl: (kind: string, q?: Record<string, string>) => `https://test.example/api/payments/korapay/${kind}-callback${q ? "?" + new URLSearchParams(q) : ""}` }));
vi.mock("@/lib/payments/pending", () => ({ createPendingPayment: vi.fn(), markPaymentFailed: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/plugins", () => ({ ensureSystemPlugins: vi.fn(), getPluginEntitlement: (...a: unknown[]) => entitlement(...a) }));

import { installFreePlugin, startPluginPurchase } from "@/lib/actions/plugins";

describe("plugin install/purchase gating", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("refuses to install a coming-soon app even when free", async () => {
    entitlement.mockResolvedValue({ allowed: true, installed: false, plugin: { id: "p1", isFree: true, isComingSoon: true, price: 0 } });
    const r = await installFreePlugin("shop", "fleet");
    expect(r.success).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses to purchase a coming-soon app", async () => {
    entitlement.mockResolvedValue({ allowed: true, installed: false, plugin: { id: "p1", isFree: false, isComingSoon: true, price: 5000 } });
    const r = await startPluginPurchase("shop", "fleet");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/coming soon/i);
  });

  it("installs a normal free app", async () => {
    entitlement.mockResolvedValue({ allowed: true, installed: false, plugin: { id: "p2", isFree: true, isComingSoon: false, price: 0 } });
    const r = await installFreePlugin("shop", "qr-codes");
    expect(r.success).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
