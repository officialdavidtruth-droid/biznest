import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: { store: { findUnique: vi.fn(), update: vi.fn() } },
  access: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/access/assert-store-access", () => ({ assertStorePermission: m.access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveTextOverride } from "@/lib/actions/text-overrides";

beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({ success: true, store: { id: "s1" } });
  m.prisma.store.findUnique.mockResolvedValue({ storefrontConfig: { promoPopup: { x: 1 }, textOverrides: { Home: "Start" } } });
});

describe("saveTextOverride", () => {
  it("adds an override and keeps the other storefrontConfig keys", async () => {
    const r = await saveTextOverride("shop", "  Shop   now ", "Buy today");
    expect(r).toEqual({ success: true, data: { Home: "Start", "Shop now": "Buy today" } });
    const data = m.prisma.store.update.mock.calls[0][0].data.storefrontConfig;
    expect(data.promoPopup).toEqual({ x: 1 });
    expect(data.textOverrides["Shop now"]).toBe("Buy today");
  });
  it("removes an override when the value is empty or equals the original", async () => {
    expect(await saveTextOverride("shop", "Home", "")).toEqual({ success: true, data: {} });
    expect(await saveTextOverride("shop", "Home", "Home")).toEqual({ success: true, data: {} });
  });
  it("needs store permission and rejects oversized text", async () => {
    m.access.mockResolvedValue({ success: false, error: "no" });
    expect((await saveTextOverride("shop", "Home", "x")).success).toBe(false);
    m.access.mockResolvedValue({ success: true, store: { id: "s1" } });
    expect((await saveTextOverride("shop", "a".repeat(400), "x")).success).toBe(false);
    expect((await saveTextOverride("shop", "Home", "x".repeat(900))).success).toBe(false);
  });
});
