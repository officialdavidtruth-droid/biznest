import { describe, it, expect } from "vitest";
import { blocksToPlainText, legacyTextToBlocks } from "@/lib/storefront/page-blocks";

describe("legacyTextToBlocks", () => {
  it("turns a text gallery into intro text and a photo grid", () => {
    const blocks = legacyTextToBlocks("gallery", "Our rooms\nhttps://ok.example/a.jpg | Lobby\nhttps://ok.example/b.jpg");
    expect(blocks.map((b) => b.type)).toEqual(["text", "gallery"]);
    expect((blocks[1] as { images: { url: string; caption: string }[] }).images).toEqual([
      { url: "https://ok.example/a.jpg", caption: "Lobby" },
      { url: "https://ok.example/b.jpg", caption: "" },
    ]);
  });

  it("splits more than 24 photos across several grids", () => {
    const body = Array.from({ length: 30 }, (_, i) => `https://ok.example/${i}.jpg`).join("\n");
    const blocks = legacyTextToBlocks("gallery", body);
    expect(blocks.map((b) => b.type)).toEqual(["gallery", "gallery"]);
    expect((blocks[0] as { images: unknown[] }).images).toHaveLength(24);
    expect((blocks[1] as { images: unknown[] }).images).toHaveLength(6);
  });

  it("turns blank-line separated questions into one questions block", () => {
    const blocks = legacyTextToBlocks("faq", "Do you deliver?\nYes, in Abuja.\n\nCan I pay later?\nNot yet.\n\nNo answer here");
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { items: { q: string; a: string }[] }).items).toEqual([
      { q: "Do you deliver?", a: "Yes, in Abuja." },
      { q: "Can I pay later?", a: "Not yet." },
    ]);
  });

  it("turns blog posts into headings and text with a divider between posts", () => {
    const blocks = legacyTextToBlocks("blog", "First post\nHello there\n---\nSecond post\nMore news");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "text", "divider", "heading", "text"]);
  });

  it("falls back to one text block per paragraph for other pages, and nothing for an empty page", () => {
    expect(legacyTextToBlocks("about", "One\n\nTwo")).toHaveLength(2);
    expect(legacyTextToBlocks("gallery", "")).toEqual([]);
    expect(legacyTextToBlocks("faq", "")).toEqual([]);
  });

  it("keeps the old text format readable after a round trip", () => {
    const body = "https://ok.example/a.jpg | Lobby\nhttps://ok.example/b.jpg";
    expect(blocksToPlainText(legacyTextToBlocks("gallery", body))).toBe(body);
  });
});
