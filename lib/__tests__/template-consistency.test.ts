import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEMPLATE_REGISTRY, PUBLIC_TEMPLATE_REGISTRY, isTemplateCompatibleWithBusiness } from "@/lib/template-registry";
import { resolveHomeRenderer, SCREENSHOT_PALETTES } from "@/lib/storefront/resolve-renderer";
import { SIGNATURE_DEDICATED_RENDERER } from "@/lib/storefront/signature-renderers";
import { canonicalizeBusinessType } from "@/lib/business-identity";
import { containsDemoClaim } from "@/lib/template-quality";
import {
  LEGACY_CATEGORY_BY_NAME, SIGNATURE_CATEGORY_BY_MODE, SIGNATURE_SUPPORTS_BY_MODE,
  RESTORED_LEGACY_TEMPLATE_CATALOG, SIGNATURE_TEMPLATE_CATALOG, getTemplateTheme, FRESH_THEME,
} from "@/lib/template-themes";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("renderer resolution is shared", () => {
  it("runtime and preview both use resolveHomeRenderer and keep no private name lists", () => {
    for (const file of ["components/storefront/storefront-runtime.tsx", "app/template-preview/[name]/page.tsx"]) {
      const src = read(file);
      expect(src, file).toContain("resolveHomeRenderer");
      expect(src, file).not.toContain("legacyNames");
      expect(src, file).not.toContain("signatureMap");
    }
  });
  it("every registry entry's `home` agrees with the resolver", () => {
    for (const t of TEMPLATE_REGISTRY) expect(t.home, t.name).toBe(resolveHomeRenderer(t.name).kind);
  });
  it("every dedicated signature renderer has a palette", () => {
    for (const mode of Object.values(SIGNATURE_DEDICATED_RENDERER)) expect(SCREENSHOT_PALETTES, mode).toHaveProperty(mode);
  });
  it("every legacy template resolves to the legacy renderer", () => {
    for (const t of RESTORED_LEGACY_TEMPLATE_CATALOG) expect(resolveHomeRenderer(t.variationName).kind, t.variationName).toBe("legacy");
  });
});

describe("catalog data", () => {
  it("seed/registry categories come from the shared maps and are real business types", () => {
    for (const t of PUBLIC_TEMPLATE_REGISTRY) expect(canonicalizeBusinessType(t.category), t.name).not.toBe("Other");
    for (const c of Object.values(LEGACY_CATEGORY_BY_NAME)) expect(["Automotive"].includes(c) || canonicalizeBusinessType(c) !== "Other", c).toBe(true);
    for (const t of SIGNATURE_TEMPLATE_CATALOG) {
      expect(SIGNATURE_CATEGORY_BY_MODE[t.signatureMode], t.signatureMode).toBeTruthy();
      expect(SIGNATURE_SUPPORTS_BY_MODE[t.signatureMode]?.length, t.signatureMode).toBeGreaterThan(0);
    }
  });
  it("template copy contains no unverifiable marketing claims", () => {
    for (const t of [...RESTORED_LEGACY_TEMPLATE_CATALOG, ...SIGNATURE_TEMPLATE_CATALOG] as any[])
      expect(containsDemoClaim([t.eyebrow, t.headline, t.sub, t.cta].join(" ")), t.variationName).toBe(false);
  });
});

describe("compatibility", () => {
  const sig = PUBLIC_TEMPLATE_REGISTRY.filter((t) => t.id.startsWith("signature-"));
  it("a cleaning business is not offered sneaker or hotel templates", () => {
    const offered = sig.filter((t) => isTemplateCompatibleWithBusiness(t, "Cleaning")).map((t) => t.name);
    expect(offered).toEqual(["Pure — Cleaning Services"]);
  });
  it("hotels get the hotel templates", () => {
    const offered = TEMPLATE_REGISTRY.filter((t) => isTemplateCompatibleWithBusiness(t, "Hotel & Lodging")).map((t) => t.name);
    expect(offered).toEqual(expect.arrayContaining(["Maison — Hotel & Stay", "Grand — Hotel & Hospitality", "Veloura — Superior Luxury Hotel"]));
    expect(offered).not.toContain("Kinetic — Sneaker Drop");
  });
  it("business types nobody targets still see the whole catalog (no empty gallery)", () => {
    for (const b of ["Church", "Logistics", "Health"]) expect(TEMPLATE_REGISTRY.filter((t) => isTemplateCompatibleWithBusiness(t, b)).length, b).toBe(TEMPLATE_REGISTRY.length);
  });
  it("every canonical business type has at least one template", () => {
    for (const b of ["Restaurant", "Fashion", "Retail", "Beauty", "Salon", "Photography", "Agency", "Cleaning", "Construction", "Real Estate", "Electronics", "Other"])
      expect(TEMPLATE_REGISTRY.some((t) => isTemplateCompatibleWithBusiness(t, b)), b).toBe(true);
  });
});

describe("getTemplateTheme", () => {
  it("resolves by business category instead of always returning Fresh & Co.", () => {
    expect(getTemplateTheme("Restaurant", "x").bg).not.toBe(FRESH_THEME.bg);
    expect(getTemplateTheme("Cleaning", "x").bg).not.toBe(getTemplateTheme("Restaurant", "x").bg);
    expect(getTemplateTheme(undefined, "x").bg).toBe(FRESH_THEME.bg);
  });
});

// ---------------------------------------------------------------------------
// Repetition guards (builder copy, hero styles, promo claims)
// ---------------------------------------------------------------------------
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";
import { resolveStoreTheme } from "@/lib/template-themes";

const builderTemplates = () => PUBLIC_TEMPLATE_REGISTRY.filter((t) => t.home === "builder");
const sectionsOf = (name: string) => {
  const theme = resolveStoreTheme(undefined, "Demo", null, null, name);
  return templateThemeToBuilderConfig(theme, "Demo", "A demo business", null).sections;
};

describe("builder templates are not one page in different colours", () => {
  it("no two builder templates share the same set of section headings", () => {
    const seen = new Map<string, string>();
    for (const t of builderTemplates()) {
      const key = sectionsOf(t.name).filter((s) => s.type !== "hero" && s.type !== "catalog").map((s) => `${s.type}:${s.settings.heading}`).join("|");
      expect(seen.get(key), `${t.name} duplicates the headings of ${seen.get(key)}`).toBeUndefined();
      seen.set(key, t.name);
    }
  });
  it("niche templates do not use the generic fallback headings", () => {
    const generic = ["Built around what matters", "Designed around your needs", "Let's work together", "What customers say"];
    for (const name of ["Ember — Restaurant", "Pure — Cleaning Services", "Forge — Construction", "Frame — Photography Studio"]) {
      const headings = sectionsOf(name).map((s) => s.settings.heading);
      for (const g of generic) expect(headings, `${name} still uses "${g}"`).not.toContain(g);
    }
  });
  it("heroStyle reaches the hero section", () => {
    const styles = new Set(builderTemplates().map((t) => sectionsOf(t.name).find((s) => s.type === "hero")!.settings.heroStyle));
    expect(styles.size).toBeGreaterThan(1);
    expect(styles.has("fullbleed") && styles.has("split")).toBe(true);
  });
  it("builder renderer implements every hero style the themes use", () => {
    const src = read("components/storefront/builder-renderer.tsx");
    for (const style of ["fullbleed", "centered"]) expect(src).toContain(`heroStyle === "${style}"`);
  });
});

describe("no hardcoded promotional claims in legacy templates", () => {
  it("legacy renderer contains none of the known unverifiable phrases", () => {
    const src = read("components/storefront/legacy-template-renderer.tsx");
    for (const phrase of ["Fast delivery", "Buyer protection", "Verified sellers", "Up to 40% off", "FLASH SALE", "Secure payments", "Secure checkout", "Airport pickup", "Secure booking", "Verified listings", "verified properties"])
      expect(src, phrase).not.toContain(phrase);
  });
});

describe("template copy is written for customers, not about the template", () => {
  it("no public template sub-headline describes itself as a storefront/website", () => {
    for (const t of PUBLIC_TEMPLATE_REGISTRY) {
      const sub = String((t.theme as any).sub || "");
      expect(sub, `${t.name}: "${sub}"`).not.toMatch(/storefront|website/i);
    }
  });
  it("the merchant's own description wins over template copy in the hero", () => {
    const theme = resolveStoreTheme(undefined, "Demo", null, null, "Ember — Restaurant");
    const hero = templateThemeToBuilderConfig(theme, "Demo", "Our own words", null).sections.find((s) => s.type === "hero")!;
    expect(hero.settings.body).toBe("Our own words");
  });
});
