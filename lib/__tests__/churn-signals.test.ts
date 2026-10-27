import { describe, expect, it } from "vitest";
import { detectChurnSignals, type StoreSnapshot } from "@/lib/churn/signals";

const now = new Date("2026-11-01T00:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);

const healthy: StoreSnapshot = {
  now,
  storeCreatedAt: ago(90),
  ownerLastLoginAt: ago(1),
  lastOrderAt: ago(2),
  lastActivityAt: ago(1),
  subscriptionPastDueSince: null,
  paidPlugins: [],
};
const kinds = (s: Partial<StoreSnapshot>) => detectChurnSignals({ ...healthy, ...s }).map((x) => x.kind);

describe("detectChurnSignals", () => {
  it("flags nothing for a healthy store", () => expect(kinds({})).toEqual([]));

  it("NO_LOGIN fires at 7 days, not 6", () => {
    expect(kinds({ ownerLastLoginAt: ago(6) })).toEqual([]);
    expect(kinds({ ownerLastLoginAt: ago(7) })).toEqual(["NO_LOGIN"]);
  });

  it("unknown last login falls back to store creation (no false alarm for new stores)", () => {
    expect(kinds({ ownerLastLoginAt: null, storeCreatedAt: ago(3), lastOrderAt: null })).toEqual([]);
  });

  it("NO_ORDERS fires at 14 days, and for a store old enough that never sold", () => {
    expect(kinds({ lastOrderAt: ago(13) })).toEqual([]);
    expect(kinds({ lastOrderAt: ago(14) })).toEqual(["NO_ORDERS"]);
    expect(kinds({ lastOrderAt: null })).toEqual(["NO_ORDERS"]);
  });

  it("does not flag NO_ORDERS for a store younger than 14 days", () => {
    expect(kinds({ storeCreatedAt: ago(5), lastOrderAt: null })).toEqual([]);
  });

  it("PAYMENT_FAILED for the plan and for each plugin separately", () => {
    const out = detectChurnSignals({
      ...healthy,
      subscriptionPastDueSince: ago(1),
      lastActivityAt: ago(0),
      paidPlugins: [{ key: "pos", name: "POS", installedAt: ago(40), pastDueSince: ago(2) }],
    });
    expect(out.filter((x) => x.kind === "PAYMENT_FAILED").map((x) => x.subject)).toEqual(["plan", "plugin:pos"]);
  });

  it("UNUSED_PLUGIN: installed 14+ days with no store activity since", () => {
    const plugin = { key: "crm", name: "CRM", installedAt: ago(20), pastDueSince: null };
    expect(kinds({ paidPlugins: [plugin], lastActivityAt: ago(30) })).toEqual(["UNUSED_PLUGIN"]);
    expect(kinds({ paidPlugins: [plugin], lastActivityAt: null })).toEqual(["UNUSED_PLUGIN"]);
    expect(kinds({ paidPlugins: [plugin], lastActivityAt: ago(1) })).toEqual([]);
    expect(kinds({ paidPlugins: [{ ...plugin, installedAt: ago(10) }], lastActivityAt: null })).toEqual([]);
  });
});
