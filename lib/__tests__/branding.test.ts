import { APP_URL } from "@/lib/constants/app-url";
import { describe, expect, it } from "vitest";
import { biznestPromoUrl, showBizNestBranding } from "@/lib/branding";

describe("showBizNestBranding", () => {
  it("shows for stores that have not started paying", () => {
    expect(showBizNestBranding({ slug: "ada", subscriptionRenewsAt: null })).toBe(true);
    expect(showBizNestBranding({ slug: "ada" })).toBe(true);
  });
  it("is removed once billing is active", () => {
    expect(showBizNestBranding({ slug: "ada", subscriptionRenewsAt: new Date() })).toBe(false);
  });
  it("never shows on the official BizNest store", () => {
    expect(showBizNestBranding({ slug: "biznest", subscriptionRenewsAt: null })).toBe(false);
  });
});

describe("biznestPromoUrl", () => {
  it("tags the store and surface", () => {
    const u = new URL(biznestPromoUrl("ada", "receipt"));
    expect(u.origin).toBe(new URL(APP_URL).origin);
    expect(u.searchParams.get("ref")).toBe("ada");
    expect(u.searchParams.get("utm_medium")).toBe("receipt");
  });
});
