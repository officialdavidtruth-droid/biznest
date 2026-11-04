import { describe, expect, it } from "vitest";
import { PUBLIC_TEMPLATE_REGISTRY, getTemplateDefinition, isTemplateCompatibleWithBusiness } from "@/lib/template-registry";
import { resolveStoreTheme } from "@/lib/template-themes";
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { ownText } from "@/lib/builder-defaults";
import { buildIndustryHomepage } from "@/lib/business-experience";

/**
 * The model template. A neutral template carries no niche wording: whatever a merchant sells, the headings, button
 * labels and sections come from that merchant's business, the way a WordPress theme takes the shape of its site.
 * New templates should be added to this file's list once they follow the same rule.
 */
const NEUTRAL = ["Horizon"];
const NICHE_WORDS = /destination|\btours?\b|listing|property|properties|\bmenu\b|dishes|\brooms?\b|\bsuites?\b|sneaker|boutique|clinic|patient|recruit|logistics|\bflights?\b/i;

const cfg = (name: string, business: { category: string; sellsProducts?: boolean; offersServices?: boolean }) => {
  const theme = resolveStoreTheme(undefined, "Acme", null, null, name);
  return templateThemeToBuilderConfig(theme, "Acme", "We do things well.", null, business);
};
/** Only the words a visitor reads (layout names like heroVariant "menu" are compositions, not wording). */
const text = (sections: { settings: Record<string, unknown> }[]) => JSON.stringify(sections.map((s) => [s.settings.eyebrow, s.settings.heading, s.settings.body, s.settings.ctaLabel]));
const words = (c: ReturnType<typeof cfg>) => text(c.sections);

describe.each(NEUTRAL)("%s is a neutral template", (name) => {
  it("is selectable by every kind of business", () => {
    const t = getTemplateDefinition(name)!;
    expect(t, "template missing from the registry").toBeTruthy();
    expect(PUBLIC_TEMPLATE_REGISTRY).toContain(t);
    expect(t.home).toBe("builder");
    expect(resolveHomeRenderer(name).kind).toBe("builder");
    for (const b of ["Restaurant", "Hotel & Lodging", "Fashion", "Salon", "Travel & Tourism", "Church", "Real Estate", "Other"]) expect(isTemplateCompatibleWithBusiness(t, b), b).toBe(true);
  });

  it("takes its call to action from the business", () => {
    for (const business of [{ category: "Fashion", sellsProducts: true, offersServices: false }, { category: "Salon", sellsProducts: false, offersServices: true }, { category: "Other", sellsProducts: true, offersServices: true }]) {
      const hero = cfg(name, business).sections.find((s) => s.type === "hero")!;
      expect(hero.settings.ctaLabel, business.category).toBe(getBusinessExperience(business.category, business).primaryAction);
      expect(hero.settings.heading).toBe("Acme");
      expect(hero.settings.body).toBe("We do things well.");
    }
  });

  it("words differ between a shop and a service business", () => {
    const shop = cfg(name, { category: "Fashion", sellsProducts: true, offersServices: false }).sections.find((s) => s.type === "catalog")!;
    const service = cfg(name, { category: "Salon", sellsProducts: false, offersServices: true }).sections.find((s) => s.type === "catalog")!;
    expect(shop.settings.heading).not.toBe(service.settings.heading);
  });

  it("contains no wording that belongs to one niche", () => {
    for (const business of [{ category: "Fashion", sellsProducts: true }, { category: "Salon", offersServices: true }, { category: "Other", sellsProducts: true, offersServices: true }, { category: "Travel & Tourism", offersServices: true }]) {
      expect(words(cfg(name, business)), business.category).not.toMatch(NICHE_WORDS);
    }
  });

  it("keeps the same look whatever the business", () => {
    const a = cfg(name, { category: "Fashion", sellsProducts: true }).design;
    const b = cfg(name, { category: "Salon", offersServices: true }).design;
    expect(a).toEqual(b);
  });
});

describe("the Builder shows the owner's own categories", () => {
  it("renders owner categories (even with no items yet) and links to their pages", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/storefront/builder-renderer.tsx", "utf8");
    expect(src).toContain("categoryList");
    expect(src).toContain("/category/${c.slug || c.id}");
    expect(readFileSync("components/storefront/storefront-runtime.tsx", "utf8").match(/categoryList=\{navCategories\}/g)?.length).toBe(4);
  });
});

describe("every template the Builder draws is neutral at render time", () => {
  const builderTemplates = PUBLIC_TEMPLATE_REGISTRY.filter((t) => t.home === "builder");
  it("there are Builder templates to check", () => expect(builderTemplates.length).toBeGreaterThan(20));

  it("uses the same wording rule as Horizon, whatever the template's own theme says", () => {
    for (const t of builderTemplates) {
      const theme = { ...resolveStoreTheme(undefined, "Acme", null, null, t.name), neutral: true };
      for (const business of [{ category: "Fashion", sellsProducts: true }, { category: "Salon", offersServices: true }, { category: "Other", sellsProducts: true, offersServices: true }]) {
        const out = text(templateThemeToBuilderConfig(theme, "Acme", "We do things well.", null, business).sections);
        expect(out, `${t.name} / ${business.category}`).not.toMatch(NICHE_WORDS);
      }
    }
  });
});

describe("sections with nothing to show are left out on the live site", () => {
  it("catalog, gallery, map, stats, testimonials and categories return nothing when empty (editor still shows them)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/storefront/builder-renderer.tsx", "utf8");
    for (const m of ['section.type === "catalog" && !catalogItems.length && !isEditMode', "if (!tiles.length && !isEditMode) return null;", "if (!query && !isEditMode) return null;", 'section.type === "categories" && !categoryLinks.length && !isEditMode', "if (!cards.length && !isEditMode) return null;"]) expect(src, m).toContain(m);
  });
  it("the default header menu is built from the owner's categories", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/storefront/builder-renderer.tsx", "utf8");
    expect(src).toContain("useStoreCategories()");
    expect(src).toContain("`/category/${c.slug || c.id}`");
  });
});

describe("a visitor only ever reads what the owner entered", () => {
  it("platform filler text is not treated as the owner's words", () => {
    expect(ownText("Tell customers what makes this business different.")).toBeUndefined();
    expect(ownText("Add your current promotion, message or business information here.")).toBeUndefined();
    expect(ownText(getBusinessExperience("Fashion", { sellsProducts: true }).description)).toBeUndefined();
    expect(ownText("  We sell good things.  ")).toBe("We sell good things.");
    expect(ownText("")).toBeUndefined();
    expect(ownText(null)).toBeUndefined();
  });

  it("with no description entered, no section is given invented body text", () => {
    for (const business of [{ category: "Fashion", sellsProducts: true }, { category: "Salon", offersServices: true }, { category: "Other", sellsProducts: true, offersServices: true }, { category: "Professional Services", offersServices: true }]) {
      for (const sec of buildIndustryHomepage(business.category, "Acme", null, null, business).sections) expect(ownText(sec.settings.body), `${business.category} / ${sec.type} has filler body "${sec.settings.body}"`).toBe(sec.settings.body);
    }
  });

  it("the default builder layout no longer writes filler either", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("lib/builder-config.ts", "utf8")).not.toContain("Tell customers why your business is different.");
  });

  it("features and FAQ show only owner-written entries on the live site", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("components/storefront/builder-renderer.tsx", "utf8");
    expect(src).not.toContain("defaultFeatureItems(experience.mode)");
    expect(src).not.toContain("defaultFaqItems(experience.mode");
    expect(src).toContain('section.type === "text" && !s.body && !isEditMode');
  });
});
