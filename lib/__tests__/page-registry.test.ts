import { describe, it, expect } from "vitest";
import { CONTENT_PAGES, SYSTEM_PAGE_REDIRECTS, isPlaceholderContent, ownerPageBody } from "@/lib/storefront/page-registry";
import { SUGGESTED_PAGE_SLUGS, SUGGESTED_PAGE_TITLES, RESERVED_PAGE_SLUGS } from "@/lib/actions/pages-constants";

describe("page registry", () => {
  it("reads the body only from owner text pages", () => {
    expect(ownerPageBody({ body: "Hello" })).toBe("Hello");
    expect(ownerPageBody({ body: "" })).toBe("");
    expect(ownerPageBody({ blocks: [] })).toBeNull();
    expect(ownerPageBody({ type: "grandeur-events", events: [] })).toBeNull();
    expect(ownerPageBody(null)).toBeNull();
    expect(ownerPageBody([])).toBeNull();
    expect(ownerPageBody("text")).toBeNull();
  });

  it("recognises only the exact legacy placeholder", () => {
    expect(isPlaceholderContent({ blocks: [] })).toBe(true);
    expect(isPlaceholderContent({ blocks: [{ type: "x" }] })).toBe(false);
    expect(isPlaceholderContent({ blocks: [], body: "x" })).toBe(false);
    expect(isPlaceholderContent({ blocks: [], extra: 1 })).toBe(false);
    expect(isPlaceholderContent({ body: "" })).toBe(false);
    expect(isPlaceholderContent(null)).toBe(false);
  });

  it("derives the suggested pages from the registry", () => {
    expect([...SUGGESTED_PAGE_SLUGS]).toEqual(CONTENT_PAGES.map((p) => p.slug));
    for (const p of CONTENT_PAGES) expect(SUGGESTED_PAGE_TITLES[p.slug]).toBe(p.title);
  });

  it("never lists a platform page as a content page, and keeps template data out of reach", () => {
    for (const slug of Object.keys(SYSTEM_PAGE_REDIRECTS)) expect(CONTENT_PAGES.some((p) => p.slug === slug)).toBe(false);
    expect(RESERVED_PAGE_SLUGS.has("template-gallery")).toBe(true);
  });
});
