import { describe, expect, it } from "vitest";
import { BUILDER_CONFLICT_ERROR, builderConfigSaveSchema, defaultBuilderConfig, readBuilderConfig, type BuilderConfig } from "@/lib/builder-config";
import { cssUrl, fontStack, isSecureImageUrl } from "@/lib/builder-safe";
import { whatsappLink } from "@/lib/builder-defaults";

const base = (): BuilderConfig => defaultBuilderConfig("Acme");

describe("publish rules (save-time schema)", () => {
  it("accepts the default layout", () => {
    expect(builderConfigSaveSchema.safeParse(base()).success).toBe(true);
  });
  it("rejects duplicate section ids", () => {
    const c = base();
    c.sections.push({ ...c.sections[1] });
    const r = builderConfigSaveSchema.safeParse(c);
    expect(r.success).toBe(false);
  });
  it("rejects a layout with no hero", () => {
    const c = base();
    c.sections = c.sections.filter((s) => s.type !== "hero");
    expect(builderConfigSaveSchema.safeParse(c).success).toBe(false);
  });
  it("rejects a layout where every section is hidden", () => {
    const c = base();
    c.sections = c.sections.map((s) => ({ ...s, visible: false }));
    expect(builderConfigSaveSchema.safeParse(c).success).toBe(false);
  });
  it("rejects plain http images on save but still reads them", () => {
    const c = base();
    c.sections[0].settings.image = "http://example.com/a.jpg";
    expect(builderConfigSaveSchema.safeParse(c).success).toBe(false);
    expect(readBuilderConfig(c)).not.toBeNull();
    expect(isSecureImageUrl("https://example.com/a.jpg")).toBe(true);
    expect(isSecureImageUrl("/uploads/a.jpg")).toBe(true);
  });
});

describe("reading old data", () => {
  it("keeps a layout with duplicate ids working by renaming the repeats", () => {
    const c = base();
    c.sections.push({ ...c.sections[1] });
    const read = readBuilderConfig(c)!;
    const ids = read.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("helpers", () => {
  it("encodes parentheses in css urls and still blocks quotes", () => {
    expect(cssUrl("https://x.com/a_(1).png")).toBe('"https://x.com/a_%281%29.png"');
    expect(cssUrl('https://x.com/a".png')).toBe("none");
  });
  it("adds a fallback to font names", () => {
    expect(fontStack("Inter")).toBe('"Inter", system-ui, sans-serif');
    expect(fontStack("")).toBe("system-ui, sans-serif");
    expect(fontStack('x"; color:red')).not.toContain('"; ');
  });
  it("builds wa.me links from Nigerian numbers", () => {
    expect(whatsappLink("2348012345678")).toBe("https://wa.me/2348012345678");
    expect(whatsappLink("0801 234 5678")).toBe("https://wa.me/2348012345678");
    expect(whatsappLink("+234 801 234 5678")).toBe("https://wa.me/2348012345678");
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink("123")).toBeNull();
  });
  it("exposes a conflict message the editor can match on", () => {
    expect(BUILDER_CONFLICT_ERROR.length).toBeGreaterThan(10);
  });
});
