import { describe, expect, it } from "vitest";
import { PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { skinKey } from "@/lib/storefront/page-skin";
import { pageSkinFor } from "@/lib/storefront/page-skin-resolve";

describe("page skin", () => {
  it("every template gets its own cart/checkout/pay recipe", () => {
    const seen = new Map<string, string>();
    for (const t of PUBLIC_TEMPLATE_REGISTRY) {
      const k = skinKey(pageSkinFor(t.name));
      expect(seen.get(k), `${t.name} duplicates ${seen.get(k)}`).toBeUndefined();
      seen.set(k, t.name);
    }
  });
});
