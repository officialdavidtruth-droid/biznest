import { describe, it, expect } from "vitest";
import { isSystemPageKey, readAllSystemSections, readSystemSections, sanitizeSystemSections, withSystemSections } from "@/lib/storefront/system-sections";

describe("system page sections", () => {
  it("only knows shop, product and cart", () => {
    expect(["shop", "product", "cart"].every(isSystemPageKey)).toBe(true);
    for (const k of ["home", "checkout", "", "__proto__", 5, null]) expect(isSystemPageKey(k)).toBe(false);
  });

  it("drops unsafe or empty blocks and bad shapes", () => {
    expect(sanitizeSystemSections("x")).toEqual({ above: [], below: [] });
    const s = sanitizeSystemSections({ above: [{ type: "button", label: "Go", href: "javascript:1" }, { type: "text", text: "Free delivery" }], below: "nope" });
    expect(s.above).toHaveLength(1);
    expect(s.below).toEqual([]);
  });

  it("never repeats a block id between above and below", () => {
    const s = sanitizeSystemSections({ above: [{ id: "same", type: "divider" }], below: [{ id: "same", type: "divider" }] });
    expect(new Set([...s.above, ...s.below].map((b) => b.id)).size).toBe(2);
  });

  it("reads only what is stored for that page", () => {
    const doc = { builder: {}, systemPages: { shop: { above: [{ type: "text", text: "Hi" }], below: [] } } };
    expect(readSystemSections(doc, "shop").above).toHaveLength(1);
    expect(readSystemSections(doc, "cart")).toEqual({ above: [], below: [] });
    expect(readSystemSections(null, "shop")).toEqual({ above: [], below: [] });
    expect(readSystemSections({ systemPages: [] }, "shop")).toEqual({ above: [], below: [] });
    expect(Object.keys(readAllSystemSections(doc))).toEqual(["shop", "product", "cart"]);
  });

  it("changes one page and leaves every other key alone", () => {
    const current = { builder: { a: 1 }, faq: ["x"], systemPages: { cart: { above: [], below: [{ id: "k", type: "divider" }] } } };
    const next = withSystemSections(current, "shop", { above: [{ id: "a1", type: "divider" }], below: [] });
    expect(next.builder).toEqual({ a: 1 });
    expect(next.faq).toEqual(["x"]);
    expect((next.systemPages as Record<string, unknown>).cart).toEqual(current.systemPages.cart);
    expect((next.systemPages as Record<string, unknown>).shop).toBeTruthy();
    expect(current.systemPages).not.toHaveProperty("shop");
  });

  it("removes the page, and then the whole key, when its sections are emptied", () => {
    const one = { systemPages: { shop: { above: [{ id: "a", type: "divider" }], below: [] } }, builder: 1 };
    expect(withSystemSections(one, "shop", { above: [], below: [] })).toEqual({ builder: 1 });
  });
});
