import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { store: { findUnique: vi.fn() }, payment: { findUnique: vi.fn() } } }));

import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  encryptSecret,
  flutterwaveKeyMode,
  maskKey,
  paystackKeyMode,
  resolveStoreGateway,
  secretKeyForPayment,
} from "@/lib/payments/store-gateway";

beforeEach(() => {
  process.env.STORE_GATEWAY_ENCRYPTION_KEY = "test-encryption-key";
  vi.clearAllMocks();
});

describe("store gateway secrets", () => {
  it("round-trips a secret and never stores it in plain text", () => {
    const stored = encryptSecret("sk_live_abc123");
    expect(stored).not.toContain("sk_live_abc123");
    expect(decryptSecret(stored)).toBe("sk_live_abc123");
  });

  it("rejects tampered ciphertext", () => {
    const stored = encryptSecret("sk_live_abc123");
    const parts = stored.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("detects live/test key modes", () => {
    expect(paystackKeyMode("sk_live_abc")).toBe("live");
    expect(paystackKeyMode("pk_test_abc")).toBe("test");
    expect(paystackKeyMode("nonsense")).toBeNull();
    expect(flutterwaveKeyMode("FLWSECK-abc-X")).toBe("live");
    expect(flutterwaveKeyMode("FLWSECK_TEST-abc-X")).toBe("test");
    expect(flutterwaveKeyMode("FLWPUBK_TEST-abc-X")).toBe("test");
  });

  it("masks keys for display", () => {
    expect(maskKey("sk_live_abcdefghijklmnop")).toBe("sk_live_••••mnop");
    expect(maskKey(null)).toBeNull();
  });
});

describe("resolveStoreGateway", () => {
  it("is 'none' when the store hasn't switched its own gateway on", async () => {
    (prisma.store.findUnique as any).mockResolvedValue({ ownGatewayEnabled: false, ownGatewayProvider: "PAYSTACK" });
    expect(await resolveStoreGateway("s1")).toEqual({ status: "none" });
  });

  it("returns the decrypted credentials when enabled", async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      ownGatewayEnabled: true,
      ownGatewayProvider: "PAYSTACK",
      ownPaystackSecretKey: encryptSecret("sk_live_abc"),
      ownPaystackPublicKey: "pk_live_abc",
      ownFlutterwaveSecretKey: null,
      ownFlutterwavePublicKey: null,
      ownFlutterwaveSecretHash: null,
    });
    const res = await resolveStoreGateway("s1");
    expect(res).toMatchObject({ status: "ok", credentials: { provider: "PAYSTACK", secretKey: "sk_live_abc", publicKey: "pk_live_abc" } });
  });

  it("errors instead of silently falling back to the platform when keys can't be read", async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      ownGatewayEnabled: true,
      ownGatewayProvider: "PAYSTACK",
      ownPaystackSecretKey: "garbage",
      ownPaystackPublicKey: null,
      ownFlutterwaveSecretKey: null,
      ownFlutterwavePublicKey: null,
      ownFlutterwaveSecretHash: null,
    });
    expect((await resolveStoreGateway("s1")).status).toBe("error");
  });
});

describe("secretKeyForPayment", () => {
  it("returns undefined for platform payments so the platform key is used", async () => {
    expect(await secretKeyForPayment({ usesStoreGateway: false, storeId: "s1", provider: "PAYSTACK" })).toBeUndefined();
  });

  it("returns '' (never the platform key) when a store payment's keys are gone", async () => {
    (prisma.store.findUnique as any).mockResolvedValue({
      ownPaystackSecretKey: null,
      ownPaystackPublicKey: null,
      ownFlutterwaveSecretKey: null,
      ownFlutterwavePublicKey: null,
      ownFlutterwaveSecretHash: null,
    });
    expect(await secretKeyForPayment({ usesStoreGateway: true, storeId: "s1", provider: "PAYSTACK" })).toBe("");
  });
});
