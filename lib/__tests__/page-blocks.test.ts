import { describe, it, expect } from "vitest";
import { blocksToPlainText, hasPageContent, newBlock, ownerPageBlocks, pageUsesBlocks, sanitizeBlocks, textToBlocks } from "@/lib/storefront/page-blocks";
import { parseGalleryBody } from "@/lib/storefront/owner-page-format";

describe("sanitizeBlocks", () => {
  it("drops anything that is not a valid block", () => {
    expect(sanitizeBlocks("x")).toEqual([]);
    expect(sanitizeBlocks([null, 1, "a", {}, { type: "nope" }, { type: "text", text: "   " }])).toEqual([]);
  });

  it("blocks unsafe links and images", () => {
    const out = sanitizeBlocks([
      { type: "button", label: "Go", href: "javascript:alert(1)" },
      { type: "button", label: "Go", href: "//evil.example" },
      { type: "button", label: "Call", href: "tel:+2348012345678" },
      { type: "image", url: "http://insecure.example/a.png" },
      { type: "image", url: "https://ok.example/a.png", alt: "A" },
      { type: "gallery", images: [{ url: "javascript:x" }, { url: "https://ok.example/b.png" }] },
    ]);
    expect(out.map((b) => b.type)).toEqual(["button", "image", "gallery"]);
    expect((out[2] as { images: unknown[] }).images).toHaveLength(1);
  });

  it("keeps ids unique, caps lengths and counts", () => {
    const out = sanitizeBlocks([{ id: "a", type: "text", text: "x".repeat(9000) }, { id: "a", type: "text", text: "y" }]);
    expect(out[0].id).not.toBe(out[1].id);
    expect((out[0] as { text: string }).text).toHaveLength(5000);
    expect(sanitizeBlocks(Array.from({ length: 200 }, () => ({ type: "divider" })))).toHaveLength(60);
  });

  it("drops empty FAQ rows and keeps the rest", () => {
    const out = sanitizeBlocks([{ type: "faq", items: [{ q: "Q1", a: "A1" }, { q: "", a: "A2" }, { q: "Q3", a: "" }] }]);
    expect((out[0] as { items: unknown[] }).items).toHaveLength(1);
    expect(sanitizeBlocks([{ type: "faq", items: [{ q: "", a: "" }] }])).toEqual([]);
  });
});

describe("plain-text version", () => {
  it("writes FAQ as blank-line separated question/answer pairs", () => {
    const b = sanitizeBlocks([{ type: "faq", items: [{ q: "Q1", a: "A1" }, { q: "Q2", a: "A2" }] }]);
    expect(blocksToPlainText(b)).toBe("Q1\nA1\n\nQ2\nA2");
  });

  it("writes photo grids in the format the gallery parser reads", () => {
    const b = sanitizeBlocks([{ type: "gallery", images: [{ url: "https://ok.example/a.png", caption: "One" }, { url: "https://ok.example/b.png" }] }]);
    const parsed = parseGalleryBody(blocksToPlainText(b));
    expect(parsed.images.map((i) => i.url)).toEqual(["https://ok.example/a.png", "https://ok.example/b.png"]);
    expect(parsed.images[0].caption).toBe("One");
  });

  it("turns an older text page into one text block per paragraph", () => {
    const b = textToBlocks("First.\n\nSecond.\nStill second.");
    expect(b).toHaveLength(2);
    expect(blocksToPlainText(b)).toBe("First.\n\nSecond.\nStill second.");
  });
});

describe("page content checks", () => {
  it("sees blocks even when the text version is empty", () => {
    const img = sanitizeBlocks([{ type: "image", url: "https://ok.example/a.png" }]);
    expect(hasPageContent({ body: "", blocks: img })).toBe(true);
    expect(hasPageContent({ body: "" })).toBe(false);
    expect(hasPageContent({ blocks: [] })).toBe(false);
    expect(hasPageContent({ body: "Hello" })).toBe(true);
    expect(ownerPageBlocks({ body: "x", blocks: [{ type: "text", text: "<b>hi</b>" }, { type: "button", label: "x", href: "javascript:1" }] })).toHaveLength(1);
  });

  it("keeps fixed-format pages on the text editor", () => {
    for (const s of ["faq", "policies", "gallery", "blog"]) expect(pageUsesBlocks(s)).toBe(false);
    for (const s of ["about", "contact", "shipping"]) expect(pageUsesBlocks(s)).toBe(true);
  });

  it("makes new blocks that are empty until filled", () => {
    for (const t of ["heading", "text", "image", "button", "faq", "gallery"] as const) expect(sanitizeBlocks([newBlock(t)])).toEqual([]);
    expect(sanitizeBlocks([newBlock("divider")])).toHaveLength(1);
  });
});
