import { beforeAll, describe, expect, it } from "vitest";
import { adminSessionIdFromToken, constantTimeEquals, createAdminToken, verifyAdminToken } from "@/lib/admin-pin-auth";

describe("admin PIN token", () => {
  beforeAll(() => {
    process.env.ADMIN_PIN_SECRET = "test-secret";
  });

  it("verifies a fresh token and exposes a session id", async () => {
    const t = await createAdminToken();
    expect(await verifyAdminToken(t)).toBe(true);
    expect(adminSessionIdFromToken(t)).toMatch(/^[0-9a-f-]{8}$/);
  });

  it("gives different sign-ins different session ids", async () => {
    const a = adminSessionIdFromToken(await createAdminToken());
    const b = adminSessionIdFromToken(await createAdminToken());
    expect(a).not.toBe(b);
  });

  it("rejects tampered, expired and empty tokens", async () => {
    const t = await createAdminToken();
    const [payload, sig] = t.split(".");
    const [exp, id] = payload.split(":");
    expect(await verifyAdminToken(`${Number(exp) + 1000}:${id}.${sig}`)).toBe(false);
    expect(await verifyAdminToken(`${Date.now() - 1}:${id}.${sig}`)).toBe(false);
    expect(await verifyAdminToken("")).toBe(false);
    expect(await verifyAdminToken(undefined)).toBe(false);
  });

  it("compares PINs without caring about length differences", async () => {
    expect(await constantTimeEquals("123456", "123456")).toBe(true);
    expect(await constantTimeEquals("123456", "12345")).toBe(false);
    expect(await constantTimeEquals("", "123456")).toBe(false);
  });
});
