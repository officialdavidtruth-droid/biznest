import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("builder storefront routes", () => {
  it("keeps builder links under the multi-tenant /store/[slug] namespace", () => {
    const source = readFileSync(resolve(process.cwd(), "components/storefront/builder-renderer.tsx"), "utf8");
    expect(source).not.toContain("href={`/${store.slug}`}");
    expect(source).not.toContain("href={`/${store.slug}/${item.kind}/${item.id}`}");
    expect(source).not.toContain("href={`/${store.slug}/search?q=${encodeURIComponent(c)}`}");
    expect(source).toContain("href={`/store/${store.slug}`}");
    expect(source).toContain("href={`/store/${store.slug}/${item.kind}/${item.id}`}");
    expect(source).toContain("href={`/store/${store.slug}/search?q=${encodeURIComponent(c)}`}");
  });
});


describe("catalog item detail routes", () => {
  it("keeps catalog navigation inside the tenant storefront namespace", () => {
    const source = readFileSync(join(process.cwd(), "components/storefront/catalog-item-detail.tsx"), "utf8");
    expect(source).toContain("const catalogHref = `/store/${slug}/catalog`");
    expect(source).not.toContain("const catalogHref = `/${slug}`");
  });
});
