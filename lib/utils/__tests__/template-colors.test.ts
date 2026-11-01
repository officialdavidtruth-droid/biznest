import { describe, expect, it } from "vitest";
import { normalizeTemplateColors } from "@/lib/theme-colors";

describe("template colours", () => {
  it("maps accent to primary and background to secondary", () => {
    expect(normalizeTemplateColors({ accent: "#0E5B45", background: "#FFFFFF" })).toEqual({ ok: true, value: { primary: "#0e5b45", secondary: "#ffffff" } });
  });
  it("drops blanks and rejects anything that is not a 6-digit hex", () => {
    expect(normalizeTemplateColors({ accent: "", background: "" })).toEqual({ ok: true, value: {} });
    for (const bad of ["red", "#fff", "#12345g", "url(x)", "#ffffff; color:red"]) expect(normalizeTemplateColors({ accent: bad }).ok, bad).toBe(false);
    expect(normalizeTemplateColors({ background: "javascript:1" }).ok).toBe(false);
  });

  it("accepts text, card, line, header, fonts and roundness", () => {
    expect(normalizeTemplateColors({ text: "#F4F6F3", card: "#112211", muted: "#AAAAAA", border: "#223322", header: "#001100", headingFont: "Poppins", bodyFont: "DM Sans", radius: 12 })).toEqual({
      ok: true,
      value: { ink: "#f4f6f3", card: "#112211", muted: "#aaaaaa", border: "#223322", surfaceDark: "#001100", headlineFont: "'Poppins', sans-serif", font: "'DM Sans', sans-serif", radius: "12px" },
    });
  });
  it("rejects font names that could break out of a CSS font stack, and out-of-range roundness", () => {
    for (const bad of ["Poppins; color:red", "x'}body{", "url(a)", "a,b"]) expect(normalizeTemplateColors({ headingFont: bad }).ok, bad).toBe(false);
    expect(normalizeTemplateColors({ radius: 99 }).ok).toBe(false);
    expect(normalizeTemplateColors({ radius: -1 }).ok).toBe(false);
    expect(normalizeTemplateColors({ text: "red" }).ok).toBe(false);
  });
  it("accepts only known button styles and page widths", () => {
    expect(normalizeTemplateColors({ buttonStyle: "pill", containerWidth: "compact" })).toEqual({ ok: true, value: { buttonStyle: "pill", containerWidth: "compact" } });
    expect(normalizeTemplateColors({ buttonStyle: "round" }).ok).toBe(false);
    expect(normalizeTemplateColors({ containerWidth: "huge" }).ok).toBe(false);
  });
});
