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
  RESTORED_LEGACY_TEMPLATE_CATALOG, SIGNATURE_TEMPLATE_CATALOG, getTemplateTheme, FRESH_THEME, NAMED_TEMPLATE_IDENTITY, resolveStoreTheme as resolveThemeForReference,
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
  it("every legacy template now renders through the Builder with its own identity", () => {
    // The old dedicated legacy home components (and their niche wording) are gone: wording comes from the merchant.
    for (const t of RESTORED_LEGACY_TEMPLATE_CATALOG) {
      expect(NAMED_TEMPLATE_IDENTITY[t.variationName], `${t.variationName} needs a NAMED_TEMPLATE_IDENTITY entry`).toBeTruthy();
      expect(resolveHomeRenderer(t.variationName).kind, t.variationName).toBe("builder");
    }
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
    for (const b of ["Church"]) expect(TEMPLATE_REGISTRY.filter((t) => isTemplateCompatibleWithBusiness(t, b)).length, b).toBe(TEMPLATE_REGISTRY.length);
  });
  it("health, fitness, events, logistics and HR businesses are offered only their own template", () => {
    const expected: Record<string, string> = { Health: "Vitalis — Clinic & Care", "Health & Fitness": "Pulse — Fitness & Wellness", "Event Planning": "Gala — Events & Celebrations", Logistics: "Transit — Logistics & Delivery", "HR & Recruitment": "Talent — Recruitment & HR" };
    for (const [b, name] of Object.entries(expected)) expect(sig.filter((t) => isTemplateCompatibleWithBusiness(t, b)).map((t) => t.name), b).toEqual([name]);
  });
  it("every canonical business type has at least one template", () => {
    for (const b of ["Restaurant", "Fashion", "Retail", "Beauty", "Salon", "Photography", "Agency", "Cleaning", "Construction", "Real Estate", "Electronics", "Health", "Health & Fitness", "Event Planning", "Logistics", "HR & Recruitment", "Other"])
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
      // A template with no copy of its own takes its headings from the merchant's business (neutral templates), so it cannot repeat another template's wording.
      if (!resolveStoreTheme(undefined, "Demo", null, null, t.name).sectionCopy) continue;
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

describe("no hardcoded promotional claims in the Builder", () => {
  it("builder renderer contains none of the known unverifiable phrases", () => {
    const src = read("components/storefront/builder-renderer.tsx");
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

import { REFERENCE_TEMPLATE_CATALOG } from "@/lib/reference-template-catalog";
describe("reference templates resolve to their own theme", () => {
  it("none falls back to the default Fresh & Co. theme", () => {
    for (const t of REFERENCE_TEMPLATE_CATALOG) {
      const r = resolveThemeForReference(undefined, "Demo", null, null, t.variationName);
      expect(r.accent, `${t.variationName} accent`).toBe(t.accent);
      expect(r.bg, `${t.variationName} background`).toBe(t.bg);
    }
  });
});

// ---------------------------------------------------------------------------
// One chrome per template: home, product, category, contact and cart share a header and footer
// ---------------------------------------------------------------------------
import { STOREFRONT_PAGES, homeChrome, pageChrome, type StoreChromeInput, type StorefrontPage } from "@/lib/storefront/chrome";

/** Business situations a merchant can be in with ANY template picked: the same template must look the same in all of them. */
const BUSINESS_CONTEXTS: Record<string, Pick<StoreChromeInput, "businessCategory" | "storeBusinessType">> = {
  neutral: { businessCategory: "Retail", storeBusinessType: "Retail" },
  restaurant: { businessCategory: "Restaurant", storeBusinessType: "Restaurant" },
  hotel: { businessCategory: "Hotel & Lodging", storeBusinessType: "Hotel & Lodging" },
};
const OWNER_STATES: Record<string, Pick<StoreChromeInput, "publishedBuilder" | "ownerContactPage">> = {
  "template as shipped": {},
  "owner published a builder layout": { publishedBuilder: true },
  "owner wrote their own contact page": { ownerContactPage: true },
};
const STATE_TAG: Record<string, string> = { "template as shipped": "", "owner published a builder layout": "[published builder] ", "owner wrote their own contact page": "[owner contact page] " };
const INNER_PAGES = STOREFRONT_PAGES.filter((p) => p !== "home");

/** Every (template, business, owner state, page) whose chrome differs from that template's homepage chrome. */
const family = (chrome: string) => (chrome.startsWith("legacy:") ? "legacy" : chrome);
function chromeDivergences() {
  const out: { key: string; label: string }[] = [];
  for (const t of TEMPLATE_REGISTRY) {
    for (const [biz, b] of Object.entries(BUSINESS_CONTEXTS)) {
      for (const [state, s] of Object.entries(OWNER_STATES)) {
        const input: StoreChromeInput = { templateName: t.name, ...b, ...s };
        const home = homeChrome(input);
        for (const page of INNER_PAGES) {
          const inner = pageChrome(page, input);
          if (inner !== home) out.push({ key: `${STATE_TAG[state]}${family(home)} -> ${page}: ${family(inner)}`, label: `${t.name} | ${biz} | ${state} | ${page}: home=${home}, page=${inner}` });
        }
      }
    }
  }
  return out;
}

/**
 * Today's gaps, listed once per distinct "home chrome -> page: page chrome" so the list stays readable.
 * This is a RATCHET, not a blessing: every entry is a place where a shopper clicking from the homepage lands
 * in a different header/footer. The test below fails if a NEW kind of divergence appears, and also if an entry
 * here stops happening (so fixing one forces deleting its line and the list can only shrink).
 * To fix a gap, make that page draw the home chrome; do not add lines.
 */
const KNOWN_CHROME_GAPS: readonly string[] = [
  "[owner contact page] builder -> category: hotel",
  "[owner contact page] hotel -> cart: universal",
  "[owner contact page] hotel -> contact: builder",
  "[owner contact page] hotel -> product: universal",
  "[published builder] builder -> category: hotel",
  "builder -> category: hotel",
  "builder -> contact: hotel",
  "hotel -> cart: universal",
  "hotel -> product: universal",
];

describe("every template uses one header and footer across home, product, category, contact and cart", () => {
  it("the chrome model gives every template a chrome on every page", () => {
    for (const t of TEMPLATE_REGISTRY) for (const page of STOREFRONT_PAGES) {
      expect(pageChrome(page, { templateName: t.name, ...BUSINESS_CONTEXTS.neutral }), `${t.name} ${page}`).toBeTruthy();
    }
  });

  it("no NEW home-vs-inner chrome divergence (the known list may only shrink)", () => {
    const seen = new Set(chromeDivergences().map((d) => d.key));
    const unexpected = [...seen].filter((k) => !KNOWN_CHROME_GAPS.includes(k));
    expect(unexpected, `New header/footer mismatch between the homepage and an inner page:\n${unexpected.join("\n")}`).toEqual([]);
  });

  it("KNOWN_CHROME_GAPS has no stale entries (a fixed gap must be deleted from the list)", () => {
    const seen = new Set(chromeDivergences().map((d) => d.key));
    const stale = KNOWN_CHROME_GAPS.filter((k) => !seen.has(k));
    expect(stale, `These gaps no longer occur; remove them from KNOWN_CHROME_GAPS:\n${stale.join("\n")}`).toEqual([]);
  });

  // Strictest form of the requirement, kept as a to-do until KNOWN_CHROME_GAPS is empty.
  it.todo("strict: with KNOWN_CHROME_GAPS empty, chromeDivergences() is empty for all 49 templates");
});

describe("the chrome model still matches the routes it mirrors", () => {
  const route = (p: string) => read(`app/store/[slug]/${p}/page.tsx`);
  it("product wraps in StorefrontShell (Builder chrome for Builder stores, template skin otherwise)", () => {
    const src = route("product/[productId]");
    expect(src).toContain("<StorefrontShell");
    expect(src).not.toContain("<TemplateShell");
    expect(read("components/storefront/storefront-shell.tsx")).toContain("usesTemplateChromeFor(");
  });
  it("category: hotel redirect, Grandeur skin only for the Grandeur template, otherwise usesTemplateChromeFor", () => {
    const src = route("category/[categoryId]");
    expect(src).toContain("isHotelStore(");
    expect(src).toContain("usesGrandeurSkin(");
    expect(src).toContain("GrandeurMenu");
    expect(src).toContain("usesTemplateChromeFor(");
  });
  it("cart: no template-name branches; Grandeur skin only for unregistered restaurant stores, otherwise StorefrontShell", () => {
    const src = route("cart");
    expect(src).not.toContain("EXAMPLE_TEMPLATE_NAME");
    expect(src).not.toContain("TASTEHOUSE_TEMPLATE_NAME");
    expect(src).toContain("usesGrandeurSkin(");
    expect(src).toContain("GrandeurCart");
    expect(src).toContain("<StorefrontShell");
  });
  it("Ember (a Builder restaurant template) never switches to Grandeur", () => {
    const ember = TEMPLATE_REGISTRY.find((t) => /^Ember/.test(t.name));
    expect(ember, "Ember template missing from the registry").toBeTruthy();
    const input = { templateName: ember!.name, businessCategory: "Restaurant", storeBusinessType: "Restaurant" };
    for (const page of INNER_PAGES) expect(pageChrome(page, input), `Ember ${page}`).toBe(homeChrome(input));
  });
  it("blog pages follow the same rule as the home page", () => {
    const src = read("lib/storefront/blog-page.tsx");
    expect(src).toContain("usesTemplateChromeFor(");
    expect(src).toContain("<TemplateShell");
  });
  it("contact: owner page first, then hotel, Grandeur, builder subpage, universal section page", () => {
    const src = route("contact");
    const order = ["onlyIfCustomised:true", "isHotelStore(", "getGrandeurRestaurantData(", 'renderBuilderSubpage(slug,"contact")', 'renderUniversalSectionPage(slug,"contact")'].map((m) => src.indexOf(m));
    expect(order.every((i) => i >= 0), "a branch the model relies on is missing from contact/page.tsx").toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("home: a published builder beats every template, and builder subpages are native-only", () => {
    expect(read("components/storefront/storefront-runtime.tsx")).toMatch(/savedBuilder\)\s*\{[\s\S]*?BuilderStorefront/);
    expect(read("lib/storefront/builder-subpage.tsx")).toContain('resolveHomeRenderer(raw.template?.name, {');
  });
});
