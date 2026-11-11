import { describe, expect, it } from "vitest";
import { PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { PAGE_SKIN_TABLE, skinDistance, skinKey } from "@/lib/storefront/page-skin";
import { pageSkinFor } from "@/lib/storefront/page-skin-resolve";

describe("page skin", () => {
  it("every template has a recipe in the table", () => {
    for (const t of PUBLIC_TEMPLATE_REGISTRY) expect(PAGE_SKIN_TABLE[t.name], `${t.name} has no page skin`).toBeTruthy();
  });
  it("any two templates differ in at least 8 of the 14 page settings", () => {
    const list = PUBLIC_TEMPLATE_REGISTRY.map((t) => [t.name, pageSkinFor(t.name)] as const);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      expect(skinKey(list[i][1]) === skinKey(list[j][1]), `${list[i][0]} = ${list[j][0]}`).toBe(false);
      expect(skinDistance(list[i][1], list[j][1]), `${list[i][0]} vs ${list[j][0]}`).toBeGreaterThanOrEqual(8);
    }
  });
});
