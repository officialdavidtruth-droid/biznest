import { afterEach, describe, expect, it } from "vitest";
import { isStoreLocked } from "../store-lock";

afterEach(() => {
  delete process.env.STORE_LOCK;
  delete process.env.STORE_LOCK_EXEMPT_SLUGS;
});

describe("isStoreLocked", () => {
  it("locks a store with no plan", () => {
    expect(isStoreLocked({ subscriptionId: null, slug: "demo-shop" })).toBe(true);
  });
  it("keeps a store with a plan open", () => {
    expect(isStoreLocked({ subscriptionId: "plan_1", slug: "demo-shop" })).toBe(false);
  });
  it("never locks a marketing-only account", () => {
    expect(isStoreLocked({ subscriptionId: null, marketingOnly: true, slug: "demo-shop" })).toBe(false);
  });
  it("skips exempt slugs, ignoring case and spaces", () => {
    process.env.STORE_LOCK_EXEMPT_SLUGS = "Sample-One, sample-two";
    expect(isStoreLocked({ subscriptionId: null, slug: "sample-one" })).toBe(false);
    expect(isStoreLocked({ subscriptionId: null, slug: "sample-two" })).toBe(false);
    expect(isStoreLocked({ subscriptionId: null, slug: "other" })).toBe(true);
  });
  it("can be switched off", () => {
    process.env.STORE_LOCK = "off";
    expect(isStoreLocked({ subscriptionId: null, slug: "demo-shop" })).toBe(false);
  });
});
