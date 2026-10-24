import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEMPLATE_REGISTRY, PUBLIC_TEMPLATE_REGISTRY, getTemplateDefinition } from "@/lib/template-registry";
import { isHotelStore } from "@/lib/storefront-routing";
import { GRANDEUR_TEMPLATE_NAME, TEMPLATE_NAME } from "@/lib/template-themes";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("template audit regressions", () => {
  it("every hotel-home template gets hotel inner pages regardless of business type", () => {
    for (const t of TEMPLATE_REGISTRY.filter((x) => x.home === "hotel"))
      expect(isHotelStore({ templateName: t.name, businessCategory: "Retail", storeBusinessType: "Retail" }), t.name).toBe(true);
  });
  it("seed upserts Grandeur under its own name, never under another template's", () => {
    const seed = read("prisma/seed.ts");
    expect(seed).toContain("name: GRANDEUR_TEMPLATE_NAME");
    expect(seed).not.toMatch(/name:\s*TEMPLATE_NAME\s*,/);
    expect(GRANDEUR_TEMPLATE_NAME).not.toBe(TEMPLATE_NAME);
  });
  it("seed names are unique", () => {
    const names = TEMPLATE_REGISTRY.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it("every template is reachable by name, id and URL-encoded name (preview route)", () => {
    for (const t of TEMPLATE_REGISTRY) {
      expect(getTemplateDefinition(t.name)?.id, t.name).toBe(t.id);
      expect(getTemplateDefinition(t.id)?.id, t.id).toBe(t.id);
      expect(getTemplateDefinition(encodeURIComponent(t.name))?.id, `enc ${t.name}`).toBe(t.id);
    }
  });
  it("public /templates page is driven by the registry, not a hard-coded name list", () => {
    const src = read("app/templates/page.tsx");
    expect(src).toContain("PUBLIC_TEMPLATE_REGISTRY");
    expect(src).not.toContain("Veloura — Superior Luxury Hotel");
    expect(PUBLIC_TEMPLATE_REGISTRY.length).toBeGreaterThan(4);
  });
});

import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { SIGNATURE_DEDICATED_RENDERER } from "@/lib/storefront/signature-renderers";
describe("hotel templates share one chrome", () => {
  it("Maison and Grand render the hotel journey on the homepage too", () => {
    for (const n of ["Maison — Hotel & Stay", "Grand — Hotel & Hospitality"]) {
      expect(resolveHomeRenderer(n).kind, n).toBe("hotel");
      expect(SIGNATURE_DEDICATED_RENDERER[n], n).toBeUndefined();
    }
  });
  it("admin gallery is limited to the public catalog (+ the store's own current template)", () => {
    const src = readFileSync(resolve(process.cwd(), "app/store/[slug]/admin/templates/page.tsx"), "utf8");
    expect(src).toContain("PUBLIC_TEMPLATE_REGISTRY");
  });
});
