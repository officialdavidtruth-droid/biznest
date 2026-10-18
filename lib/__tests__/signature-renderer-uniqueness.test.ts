import { describe, expect, it } from "vitest";
import { SIGNATURE_TEMPLATE_CATALOG } from "@/lib/template-themes";
import { RENDERERS_OWNED_ELSEWHERE, SIGNATURE_DEDICATED_RENDERER } from "@/lib/storefront/signature-renderers";

describe("signature template renderers", () => {
  const entries = Object.entries(SIGNATURE_DEDICATED_RENDERER);

  it("only maps real signature templates", () => {
    const names = new Set(SIGNATURE_TEMPLATE_CATALOG.map((t) => t.variationName));
    for (const [name] of entries) expect(names.has(name)).toBe(true);
  });

  it("never shares a dedicated renderer between two templates", () => {
    const modes = entries.map(([, mode]) => mode);
    expect(new Set(modes).size).toBe(modes.length);
  });

  it("never reuses a renderer owned by a legacy/named template", () => {
    for (const [, mode] of entries) expect(RENDERERS_OWNED_ELSEWHERE).not.toContain(mode);
  });
});
