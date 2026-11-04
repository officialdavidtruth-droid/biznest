import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("storefront header keeps the customer account link", () => {
  const src = readFileSync(resolve(process.cwd(), "components/storefront/builder-renderer.tsx"), "utf8");
  it("the Builder header renders AccountLink for every business type (not only stores with a cart)", () => {
    expect(src).toContain("<AccountLink storeSlug={store.slug}");
    // the account link must sit outside the product-only cart condition
    expect(src).toMatch(/<AccountLink[^>]*\/>\s*\{experience\.mode !== "service" \? <CartLink/);
  });
});
