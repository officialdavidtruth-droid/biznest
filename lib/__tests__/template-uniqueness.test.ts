import { describe, expect, it } from "vitest";
import { PUBLIC_TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { resolveStoreTheme } from "@/lib/template-themes";

const builderTemplates = PUBLIC_TEMPLATE_REGISTRY.filter((t) => resolveHomeRenderer(t.name).kind === "builder");

describe("template uniqueness", () => {
  it("every builder-rendered template declares its own header/footer/card identity", () => {
    for (const t of builderTemplates) {
      const theme = resolveStoreTheme(t.category, "Test", null, null, t.name);
      expect(theme.chrome, `${t.name} has no chrome`).toBeTruthy();
    }
  });

  it("no two builder-rendered templates share the same header + footer + card combination", () => {
    const seen = new Map<string, string>();
    for (const t of builderTemplates) {
      const c = resolveStoreTheme(t.category, "Test", null, null, t.name).chrome!;
      const key = `${c.header}|${c.footer}|${c.card}`;
      expect(seen.get(key), `${t.name} duplicates ${seen.get(key)} (${key})`).toBeUndefined();
      seen.set(key, t.name);
    }
  });

  it("every builder-rendered template has its own hero composition", () => {
    for (const t of builderTemplates) {
      const theme = resolveStoreTheme(t.category, "Test", null, null, t.name);
      expect(theme.heroVariant, `${t.name} has no heroVariant`).toBeTruthy();
    }
  });

  it("no two builder-rendered templates share the same header + hero composition (what the gallery card shows)", () => {
    const seen = new Map<string, string>();
    for (const t of builderTemplates) {
      const theme = resolveStoreTheme(t.category, "Test", null, null, t.name);
      const key = `${theme.chrome!.header}|${theme.heroVariant}`;
      expect(seen.get(key), `${t.name} looks like ${seen.get(key)} above the fold (${key})`).toBeUndefined();
      seen.set(key, t.name);
    }
  });

  it("a dedicated home component is owned by exactly one template", () => {
    const legacy = PUBLIC_TEMPLATE_REGISTRY.filter((t) => resolveHomeRenderer(t.name).kind === "legacy").map((t) => t.name);
    // Colour-variant names must not be rendered by a sibling's component any more.
    for (const variant of ["Violet — Sunset", "Nova Studio — Ivory Minimal", "Heenzy — Boutique Rose", "ShopEase General Store", "ShopNova Marketplace", "Emarket Furniture & Home", "Electra Blue Electronics", "TechNova Mobile Store", "TechVerse Gadgets"]) {
      expect(legacy).not.toContain(variant);
    }
  });
});
