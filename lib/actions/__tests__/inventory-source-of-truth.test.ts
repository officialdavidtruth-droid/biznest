import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("inventory source of truth", () => {
  it("treats variants as the authoritative stock source for product editing", () => {
    const source = read("lib/actions/product.ts");
    expect(source).toContain("if (current.hasVariants)");
    expect(source).toContain("Parent quantity/SKU/barcode are not authoritative");
    expect(source).toContain("...(current.hasVariants ? {} : {");
  });

  it("uses active variant stock for storefront availability", () => {
    const source = read("app/store/[slug]/product/[productId]/page.tsx");
    expect(source).toContain("product.variants.some((variant) => variant.quantity > 0)");
  });

  it("uses variant stock in the admin product list", () => {
    const source = read("app/store/[slug]/admin/products/page.tsx");
    expect(source).toContain("p.variants.reduce");
    expect(source).toContain("p.variants.some");
  });

  it("includes variants in dashboard low-stock calculations", () => {
    const source = read("lib/actions/analytics.ts");
    expect(source).toContain("hasVariants: true");
    expect(source).toContain("variants.some((variant) => variant.quantity <= variant.lowStockThreshold)");
  });
});
