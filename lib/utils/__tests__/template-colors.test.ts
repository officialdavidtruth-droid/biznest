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
});
