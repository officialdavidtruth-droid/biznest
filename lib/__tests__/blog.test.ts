import { describe, expect, it } from "vitest";
import { blogHandle, excerptFor, normaliseTags, publicArticleWhere, readingMinutes, resolvePublishedAt, visibilityOf } from "@/lib/blog";
import { outline, parseInline, parseMarkdown, safeHref, safeSrc } from "@/lib/blog-markdown";

const NOW = new Date("2026-11-02T10:00:00Z");
const PAST = new Date("2026-11-01T10:00:00Z");
const FUTURE = new Date("2026-11-05T10:00:00Z");

describe("blogHandle", () => {
  it("makes clean url handles", () => expect(blogHandle("  10 Best Beaches in Lagos! ")).toBe("10-best-beaches-in-lagos"));
  it("caps the length", () => expect(blogHandle("a ".repeat(200)).length).toBeLessThanOrEqual(80));
});

describe("visibilityOf", () => {
  it("null is hidden", () => expect(visibilityOf(null, NOW)).toBe("HIDDEN"));
  it("a past date is visible", () => expect(visibilityOf(PAST, NOW)).toBe("VISIBLE"));
  it("a future date is scheduled", () => expect(visibilityOf(FUTURE, NOW)).toBe("SCHEDULED"));
});

describe("resolvePublishedAt", () => {
  it("hidden has no date", () => expect(resolvePublishedAt("HIDDEN", FUTURE, PAST, NOW)).toEqual({ publishedAt: null }));
  it("visible with no date stamps now", () => expect(resolvePublishedAt("VISIBLE", null, null, NOW)).toEqual({ publishedAt: NOW }));
  it("editing a live article keeps its original date", () => expect(resolvePublishedAt("VISIBLE", null, PAST, NOW)).toEqual({ publishedAt: PAST }));
  it("an explicit date wins, so it can be back-dated or scheduled", () => {
    expect(resolvePublishedAt("SCHEDULED", FUTURE, null, NOW)).toEqual({ publishedAt: FUTURE });
    expect(resolvePublishedAt("VISIBLE", PAST, null, NOW)).toEqual({ publishedAt: PAST });
  });
  it("a still-scheduled article made visible without a date goes live now", () => expect(resolvePublishedAt("VISIBLE", null, FUTURE, NOW)).toEqual({ publishedAt: NOW }));
});

describe("publicArticleWhere", () => {
  it("never lets hidden articles through and bounds by time", () => {
    const w = publicArticleWhere("s1", NOW);
    expect(w.storeId).toBe("s1");
    expect(w.publishedAt).toEqual({ not: null, lte: NOW });
  });
});

describe("text helpers", () => {
  it("reading time is at least one minute", () => expect(readingMinutes("hello")).toBe(1));
  it("reading time scales with length", () => expect(readingMinutes("word ".repeat(1100))).toBe(5));
  it("excerpt prefers the owner's text, else trims the body at a word", () => {
    expect(excerptFor({ excerpt: " Mine ", body: "x" })).toBe("Mine");
    const e = excerptFor({ body: "# Title\n\n" + "lorem ipsum ".repeat(40) });
    expect(e.endsWith("…")).toBe(true);
    expect(e.length).toBeLessThanOrEqual(162);
    expect(e).not.toContain("#");
  });
  it("tags are trimmed, de-duplicated case-insensitively and capped", () => {
    expect(normaliseTags(" Travel, travel ,Lagos,, ")).toEqual(["Travel", "Lagos"]);
    expect(normaliseTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(10);
  });
});

describe("markdown safety", () => {
  it("blocks script and data urls in links and images", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref("https://ok.com/a")).toBe("https://ok.com/a");
    expect(safeHref("/store/x")).toBe("/store/x");
    expect(safeSrc("http://insecure.com/a.png")).toBeNull();
    expect(safeSrc("https://res.cloudinary.com/a.png")).not.toBeNull();
  });
  it("leaves an unsafe link as plain text instead of a link node", () => {
    const nodes = parseInline("[click](javascript:alert(1))");
    expect(nodes.some((n) => n.t === "link")).toBe(false);
  });
  it("keeps raw html as text, never as markup", () => {
    const blocks = parseMarkdown("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>");
    expect(blocks.every((b) => b.t === "p")).toBe(true);
    expect(JSON.stringify(blocks)).not.toContain('"t":"img"');
  });
});

describe("markdown parsing", () => {
  const md = "# Intro\n\nHello **bold** and *it* with [a link](https://x.com).\n\n## Steps\n\n- one\n- two\n\n1. first\n2. second\n\n> quote\n\n---\n\n```\ncode\n```\n\n![pic](https://img.com/a.png)";
  it("parses each block type", () => {
    const types = parseMarkdown(md).map((b) => b.t);
    expect(types).toEqual(["h", "p", "h", "ul", "ol", "quote", "hr", "code", "img"]);
  });
  it("shifts headings down because the title is the page's h1", () => {
    const h = parseMarkdown("# A\n\n## B\n\n### C").filter((b) => b.t === "h").map((b: any) => b.level);
    expect(h).toEqual([2, 3, 4]);
  });
  it("builds an outline of h2/h3 headings", () => {
    expect(outline(parseMarkdown("# One\n\n## Two\n\n### Three"))).toEqual([{ id: "one", text: "One", level: 2 }, { id: "two", text: "Two", level: 3 }]);
  });
  it("handles windows line endings and empty input", () => {
    expect(parseMarkdown("a\r\n\r\nb")).toHaveLength(2);
    expect(parseMarkdown("")).toEqual([]);
  });
});
