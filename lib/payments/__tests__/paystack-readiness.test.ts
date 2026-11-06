import { describe, expect, it, vi } from "vitest";
import { evaluatePaystackReadiness, webhookUrl, type ReadinessInput } from "@/lib/payments/paystack-readiness";

const base: ReadinessInput = {
  secretKey: "sk_live_abc", publicKey: "pk_live_abc", serverPublicKey: "pk_live_abc",
  appUrl: "https://www.biznest.space", activeGateway: "PAYSTACK", billingGateway: "PAYSTACK",
  balance: { ok: true, message: "ok", kobo: 5_000_00 },
};
const status = (i: ReadinessInput, id: string) => evaluatePaystackReadiness(i).checks.find((c) => c.id === id)?.status;

describe("evaluatePaystackReadiness", () => {
  it("is fully ready with a matching live pair, a good address and Paystack everywhere", () => {
    const r = evaluatePaystackReadiness(base);
    expect(r.live).toBe(true);
    expect(r.blockers).toBe(0);
    expect(r.checks.filter((c) => c.status === "manual").map((c) => c.id)).toEqual(["webhook", "transfers", "otp", "whitelist", "smoke"]);
  });
  it("fails a live secret key paired with a test public key", () => {
    expect(status({ ...base, publicKey: "pk_test_abc", serverPublicKey: null }, "public")).toBe("fail");
  });
  it("warns, not fails, on a matching test pair, and is not live", () => {
    const r = evaluatePaystackReadiness({ ...base, secretKey: "sk_test_abc", publicKey: "pk_test_abc", serverPublicKey: null });
    expect(r.checks.find((c) => c.id === "secret")?.status).toBe("warn");
    expect(r.live).toBe(false);
  });
  it("fails when keys are missing or malformed", () => {
    expect(status({ ...base, secretKey: undefined, balance: null }, "secret")).toBe("fail");
    expect(status({ ...base, secretKey: " sk_live_abc" }, "secret")).toBe("fail");
    expect(status({ ...base, publicKey: undefined }, "public")).toBe("fail");
  });
  it("fails when Paystack rejects the key, and warns on an empty live balance", () => {
    expect(status({ ...base, balance: { ok: false, message: "Invalid key" } }, "api")).toBe("fail");
    expect(status({ ...base, balance: { ok: true, message: "ok", kobo: 0 } }, "balance")).toBe("warn");
  });
  it("fails for a localhost, http or vercel.app site address", () => {
    for (const appUrl of ["http://localhost:3000", "http://www.biznest.space", "https://biznest-abc.vercel.app", ""]) expect(status({ ...base, appUrl }, "url")).toBe("fail");
  });
  it("warns when store checkout or billing is still on another gateway", () => {
    expect(status({ ...base, activeGateway: "KORAPAY" }, "active")).toBe("warn");
    expect(status({ ...base, billingGateway: "KORAPAY" }, "billing")).toBe("warn");
  });
  it("builds the webhook address without a double slash", () => {
    expect(webhookUrl("https://www.biznest.space/")).toBe("https://www.biznest.space/api/payments/paystack/webhook");
  });
});

describe("billing callbacks follow the billing gateway", () => {
  it("defaults to Korapay's return routes and moves to Paystack's with BILLING_GATEWAY=PAYSTACK", async () => {
    vi.resetModules();
    delete process.env.BILLING_GATEWAY;
    let g = await import("@/lib/payments/billing-gateway");
    expect(g.PLATFORM_BILLING_GATEWAY).toBe("KORAPAY");
    expect(g.billingCallbackUrl("subscription")).toMatch(/\/api\/payments\/korapay\/subscription-callback$/);
    vi.resetModules();
    process.env.BILLING_GATEWAY = "paystack";
    g = await import("@/lib/payments/billing-gateway");
    expect(g.PLATFORM_BILLING_GATEWAY).toBe("PAYSTACK");
    expect(g.billingCallbackUrl("ad", { slug: "acme-test" })).toMatch(/\/api\/payments\/paystack\/ad-callback\?slug=acme-test$/);
    expect(g.billingCallbackUrl("plugin", { slug: "a b" })).toMatch(/plugin-callback\?slug=a\+b$/);
    delete process.env.BILLING_GATEWAY;
  });
});
