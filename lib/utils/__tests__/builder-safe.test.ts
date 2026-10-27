import { describe, expect, it } from "vitest";
import { cssUrl, isSafeColor, isSafeHref, isSafeImageUrl, safeHref } from "@/lib/builder-safe";
import { defaultBuilderConfig, readBuilderConfig } from "@/lib/builder-config";

describe("builder output safety", () => {
  it("accepts normal links and rejects script schemes", () => {
    for (const ok of ["", "#catalog", "/store/x/about", "https://wa.me/234", "mailto:a@b.com", "tel:+234 801 000 0000"]) expect(isSafeHref(ok), ok).toBe(true);
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "//evil.com", "vbscript:x"]) expect(isSafeHref(bad), bad).toBe(false);
    expect(safeHref("javascript:alert(1)", "#catalog")).toBe("#catalog");
  });
  it("rejects image values that could break out of url()", () => {
    expect(isSafeImageUrl("https://res.cloudinary.com/x/y.jpg")).toBe(true);
    expect(isSafeImageUrl("https://x.com/a.jpg); background:red")).toBe(false);
    expect(cssUrl("https://x.com/a\".jpg")).toBe("none");
    expect(cssUrl("https://x.com/a.jpg")).toBe('"https://x.com/a.jpg"');
  });
  it("rejects colours containing declaration breakouts", () => {
    for (const ok of ["#123524", "rgba(0,0,0,.5)", "hsl(120 40% 20%)", "linear-gradient(135deg, #111, #333)"]) expect(isSafeColor(ok), ok).toBe(true);
    for (const bad of ["red; position:fixed", "url(https://x)", "#fff}body{display:none"]) expect(isSafeColor(bad), bad).toBe(false);
  });
  it("schema rejects unsafe values but keeps valid configs", () => {
    const good = defaultBuilderConfig("Acme");
    expect(readBuilderConfig(good)).not.toBeNull();
    const bad = defaultBuilderConfig("Acme");
    bad.sections[0].settings.ctaHref = "javascript:alert(1)";
    expect(readBuilderConfig(bad)).toBeNull();
  });
});
