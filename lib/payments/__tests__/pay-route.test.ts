import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  own: vi.fn(),
  ready: vi.fn(),
  store: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { store: { findUnique: m.store } } }));
vi.mock("@/lib/payments/store-gateway", () => ({ resolveStoreGateway: m.own }));
vi.mock("@/lib/payments/gateway", () => ({ platformGatewayReady: m.ready }));
vi.mock("@/lib/payments/settle-invoice", () => ({}));
vi.mock("@/lib/payments/settle-quote-deposit", () => ({}));
vi.mock("@/lib/payments/settle-service-booking", () => ({}));
vi.mock("@/lib/payments/settle-reservation", () => ({}));
vi.mock("@/lib/payments/settle-travel", () => ({}));
vi.mock("@/lib/payments/settle-tailoring", () => ({}));
vi.mock("@/lib/payments/settle-rent", () => ({}));
vi.mock("@/lib/payments/settle-member", () => ({}));
vi.mock("@/lib/payments/settle-ticket", () => ({}));
vi.mock("@/lib/payments/settle-job", () => ({}));
vi.mock("@/lib/payments/pending", () => ({}));
vi.mock("@/lib/payments/manual-transfer", () => ({ manualPayInfoFromStore: (s: { manualPayEnabled?: boolean }) => s, manualPayReady: (s: { manualPayEnabled?: boolean }) => Boolean(s?.manualPayEnabled) }));
vi.mock("@/lib/store-url", () => ({ buildStoreUrl: () => "https://shop.example" }));

import { resolvePayRoute } from "@/lib/payments/manual-flow";

beforeEach(() => vi.clearAllMocks());

describe("resolvePayRoute", () => {
  it("uses the store's own keys first", async () => {
    m.own.mockResolvedValue({ status: "ok" });
    expect(await resolvePayRoute("s1")).toEqual({ mode: "gateway" });
    expect(m.ready).not.toHaveBeenCalled();
  });
  it("otherwise uses the SupaAdmin gateway, even with no bank-transfer details", async () => {
    m.own.mockResolvedValue({ status: "none" });
    m.ready.mockResolvedValue(true);
    expect(await resolvePayRoute("s1")).toEqual({ mode: "gateway" });
    expect(m.store).not.toHaveBeenCalled();
  });
  it("falls back to saved bank-transfer details only when the platform gateway has no keys", async () => {
    m.own.mockResolvedValue({ status: "none" });
    m.ready.mockResolvedValue(false);
    m.store.mockResolvedValue({ manualPayEnabled: true, manualBankName: "Test Bank", manualAccountName: "Ada Test", manualAccountNumber: "0123456789" });
    const r = await resolvePayRoute("s1");
    expect(r.mode).toBe("manual");
  });
  it("blocks payment when nothing is set up", async () => {
    m.own.mockResolvedValue({ status: "none" });
    m.ready.mockResolvedValue(false);
    m.store.mockResolvedValue(null);
    expect((await resolvePayRoute("s1")).mode).toBe("error");
  });
});
