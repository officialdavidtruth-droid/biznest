import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronAuthorized } from "@/lib/cron-auth";

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/x", { headers: auth ? { authorization: auth } : {} });

describe("isCronAuthorized", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects everything when CRON_SECRET is unset, including 'Bearer undefined'", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorized(req("Bearer undefined"))).toBe(false);
    expect(isCronAuthorized(req("Bearer "))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
  });

  it("accepts only the exact bearer secret when set", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isCronAuthorized(req("Bearer s3cret"))).toBe(true);
    expect(isCronAuthorized(req("Bearer wrong"))).toBe(false);
    expect(isCronAuthorized(req("s3cret"))).toBe(false);
    expect(isCronAuthorized(req())).toBe(false);
  });
});
