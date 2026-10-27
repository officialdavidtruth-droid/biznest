import { describe, expect, it, vi } from "vitest";

// The template registry transitively imports the Prisma client, which only exists after `prisma generate`.
// Nothing here touches the database, so a stub keeps this suite runnable with or without a generated client.
vi.mock("@prisma/client", () => ({ PrismaClient: class { $on() {} }, Prisma: {} }));

import { defaultBuilderConfig, readBuilderConfig, type BuilderConfig } from "@/lib/builder-config";
import { defaultFaqItems, defaultFeatureItems, faqFromStoreOverrides, mapDirectionsUrl, mapEmbedUrl, mapQuery } from "@/lib/builder-defaults";
import { parseBlogPosts, parseGalleryBody } from "@/lib/storefront/owner-page-format";
import { getSavedBuilder, resolveEffectiveHomeRenderer } from "@/lib/storefront/saved-builder";
import { resolveHomeRenderer, type HomeRendererKind } from "@/lib/storefront/resolve-renderer";
import { PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";

function withSettings(type: "features" | "faq" | "gallery" | "map", settings: Record<string, unknown>): BuilderConfig {
  const config = defaultBuilderConfig("Acme");
  config.sections.push({ id: `${type}-x`, type, visible: true, settings: settings as never });
  return config;
}

describe("editable features / faq / gallery / map sections", () => {
  it("accepts and keeps owner items, images and address", () => {
    const parsed = readBuilderConfig(withSettings("features", { items: [{ title: "Fast", body: "Same-day delivery" }], images: ["https://cdn.example.com/a.jpg", "/uploads/b.png"], address: "12 Aminu Kano Crescent, Abuja" }));
    const s = parsed?.sections.at(-1)?.settings;
    expect(s?.items).toEqual([{ title: "Fast", body: "Same-day delivery" }]);
    expect(s?.images).toHaveLength(2);
    expect(s?.address).toBe("12 Aminu Kano Crescent, Abuja");
  });

  it("rejects unsafe gallery image URLs and oversized lists", () => {
    expect(readBuilderConfig(withSettings("gallery", { images: ["javascript:alert(1)"] }))).toBeNull();
    expect(readBuilderConfig(withSettings("gallery", { images: ['https://x.test/a.jpg");background:url(//evil'] }))).toBeNull();
    expect(readBuilderConfig(withSettings("features", { items: Array.from({ length: 13 }, (_, i) => ({ title: `t${i}` })) }))).toBeNull();
  });

  it("old saved configs without the new fields still validate", () => {
    expect(readBuilderConfig(defaultBuilderConfig("Acme", "desc"))).not.toBeNull();
  });

  it("provides real starter text, not placeholder copy", () => {
    for (const mode of ["commerce", "service", "hybrid"]) {
      for (const item of [...defaultFeatureItems(mode), ...defaultFaqItems(mode, "hi@acme.test")]) {
        expect(item.title.length).toBeGreaterThan(3);
        expect(item.body ?? "").not.toMatch(/configured by the business/i);
      }
    }
    expect(defaultFaqItems("commerce", "hi@acme.test")[1].body).toBe("hi@acme.test");
  });

  it("turns the AI builder's FAQ into section items and ignores junk", () => {
    expect(faqFromStoreOverrides([{ question: " Q1 ", answer: "A1" }, { question: "", answer: "x" }, null, "s", { question: "Q2" }])).toEqual([{ title: "Q1", body: "A1" }]);
    expect(faqFromStoreOverrides(undefined)).toEqual([]);
  });

  it("builds map URLs from the owner's address, else the business location", () => {
    expect(mapQuery("  Wuse 2, Abuja ", { city: "Lagos", state: "Lagos", country: "Nigeria" })).toBe("Wuse 2, Abuja");
    expect(mapQuery(undefined, { city: "Lagos", state: "Lagos State", country: "Nigeria" })).toBe("Lagos, Lagos State, Nigeria");
    expect(mapQuery("", null)).toBe("");
    expect(mapEmbedUrl("A & B, Abuja")).toBe("https://www.google.com/maps?q=A%20%26%20B%2C%20Abuja&output=embed");
    expect(mapDirectionsUrl("Abuja")).toContain("query=Abuja");
  });
});

describe("owner page formats (About / Gallery / Blog / Contact pages)", () => {
  it("gallery: image URL lines become photos, other lines become intro", () => {
    const g = parseGalleryBody("Our shop in pictures\nhttps://cdn.example.com/a.jpg | Front door\n/uploads/b.png\njavascript:alert(1)\nftp://x/y.jpg");
    expect(g.images).toEqual([{ url: "https://cdn.example.com/a.jpg", caption: "Front door" }, { url: "/uploads/b.png", caption: "" }]);
    expect(g.intro).toContain("Our shop in pictures");
    expect(g.intro).toContain("javascript:alert(1)");
    expect(g.images.some((i) => /javascript/.test(i.url))).toBe(false);
  });

  it("blog: --- separates posts; a single post keeps its paragraphs", () => {
    expect(parseBlogPosts("First\nBody one\n\nBody two\n---\nSecond\nText")).toEqual([
      { title: "First", text: "Body one\n\nBody two" },
      { title: "Second", text: "Text" },
    ]);
    expect(parseBlogPosts("Only post\nLine")).toHaveLength(1);
    expect(parseBlogPosts("   ")).toEqual([]);
  });
});

describe("a published builder wins over every template's own homepage", () => {
  const saved = { builderVersion: 1, builder: defaultBuilderConfig("Acme") };

  it("reads only a valid, versioned saved builder", () => {
    expect(getSavedBuilder(saved)).not.toBeNull();
    expect(getSavedBuilder({ builderVersion: 2, builder: saved.builder })).toBeNull();
    expect(getSavedBuilder({ builderVersion: 1, builder: { version: 1 } })).toBeNull();
    expect(getSavedBuilder(null)).toBeNull();
  });

  it("every one of the registry's templates renders through the builder once the owner published", () => {
    const defs = PUBLIC_TEMPLATE_REGISTRY;
    const nonBuilder = defs.filter((d) => resolveHomeRenderer(d.name).kind !== "builder");
    expect(nonBuilder.length).toBeGreaterThan(0); // legacy, hotel, screenshot, example
    for (const d of defs) {
      expect(resolveEffectiveHomeRenderer(d.name, saved).kind satisfies HomeRendererKind).toBe("builder");
      // and nothing changes for owners who never published
      expect(resolveEffectiveHomeRenderer(d.name, {})).toEqual(resolveHomeRenderer(d.name));
    }
  });
});
