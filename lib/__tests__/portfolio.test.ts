import { describe, expect, it } from "vitest";
import { albumCategories, cleanText, displayImageUrl, isPortfolioImageUrl, portfolioPath, slugifyAlbum, uniqueAlbumSlug } from "@/lib/portfolio";

const IMG = "https://res.cloudinary.com/demo-cloud/image/upload/v1700000000/sample-folder/shoot-01.jpg";

describe("slugifyAlbum", () => {
  it("makes a clean web address", () => {
    expect(slugifyAlbum("Lagos Weddings 2026")).toBe("lagos-weddings-2026");
    expect(slugifyAlbum("  Café & Portraits!! ")).toBe("cafe-portraits");
  });
  it("never returns an empty slug", () => {
    expect(slugifyAlbum("!!!")).toBe("album");
    expect(slugifyAlbum("")).toBe("album");
  });
  it("caps the length", () => {
    expect(slugifyAlbum("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("uniqueAlbumSlug", () => {
  it("returns the base when free", () => expect(uniqueAlbumSlug("Weddings", [])).toBe("weddings"));
  it("numbers duplicates", () => {
    expect(uniqueAlbumSlug("Weddings", ["weddings"])).toBe("weddings-2");
    expect(uniqueAlbumSlug("Weddings", ["weddings", "weddings-2"])).toBe("weddings-3");
  });
});

describe("isPortfolioImageUrl", () => {
  it("accepts Cloudinary https images", () => expect(isPortfolioImageUrl(IMG)).toBe(true));
  it("rejects other hosts, http, junk and long values", () => {
    expect(isPortfolioImageUrl("https://evil.example.com/a.jpg")).toBe(false);
    expect(isPortfolioImageUrl("http://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(false);
    expect(isPortfolioImageUrl("javascript:alert(1)")).toBe(false);
    expect(isPortfolioImageUrl(42)).toBe(false);
    expect(isPortfolioImageUrl(IMG + "a".repeat(700))).toBe(false);
  });
});

describe("displayImageUrl", () => {
  it("adds auto format, quality and width without touching the original path", () => {
    expect(displayImageUrl(IMG, 800)).toBe("https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto,w_800/v1700000000/sample-folder/shoot-01.jpg");
  });
  it("leaves already-transformed and foreign URLs alone", () => {
    const done = "https://res.cloudinary.com/demo-cloud/image/upload/c_fill,w_300/sample.jpg";
    expect(displayImageUrl(done, 800)).toBe(done);
    expect(displayImageUrl("https://example.com/x.jpg", 800)).toBe("https://example.com/x.jpg");
  });
  it("clamps silly widths", () => {
    expect(displayImageUrl(IMG, 5)).toContain("w_100/");
    expect(displayImageUrl(IMG, 99999)).toContain("w_3000/");
  });
});

describe("helpers", () => {
  it("cleanText collapses whitespace and caps length", () => {
    expect(cleanText("  a   b \n c ", 50)).toBe("a b c");
    expect(cleanText("x".repeat(30), 10)).toBe("x".repeat(10));
    expect(cleanText(null, 10)).toBe("");
  });
  it("albumCategories keeps first-seen order and drops blanks and repeats", () => {
    expect(albumCategories([{ category: "Weddings" }, { category: null }, { category: " Portraits " }, { category: "Weddings" }, { category: "" }])).toEqual(["Weddings", "Portraits"]);
  });
  it("portfolioPath builds the list and album paths", () => {
    expect(portfolioPath("demo-studio")).toBe("/store/demo-studio/portfolio");
    expect(portfolioPath("demo-studio", "weddings")).toBe("/store/demo-studio/portfolio/weddings");
  });
});
