import { describe, expect, it } from "vitest";
import { PLUGIN_SALE_LABEL, PLUGIN_SALE_PURPOSES } from "@/lib/dashboard-sales-types";

describe("plugin sales", () => {
  it("never counts orders, wallet top-ups or platform charges as store sales", () => {
    for (const p of ["ORDER", "WALLET_FUNDING", "SUBSCRIPTION_UPGRADE", "SUBSCRIPTION_RENEWAL", "PLUGIN_PURCHASE", "AD_CAMPAIGN"]) {
      expect(PLUGIN_SALE_PURPOSES as readonly string[]).not.toContain(p);
    }
  });
  it("labels every counted purpose", () => {
    for (const p of PLUGIN_SALE_PURPOSES) expect(PLUGIN_SALE_LABEL[p]).toBeTruthy();
  });
});
