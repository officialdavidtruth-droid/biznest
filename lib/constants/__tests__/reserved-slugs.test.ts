import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "../reserved-slugs";

// Every top-level route under app/ (including route groups like (auth)) must be
// a reserved slug, otherwise middleware rewrites biznest.space/<route> into the
// storefront stack. Keeps the hand-maintained list from drifting.
function topLevelRoutes(): string[] {
  const appDir = join(process.cwd(), "app");
  const out: string[] = [];
  for (const d of readdirSync(appDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    if (d.name.startsWith("(")) {
      for (const s of readdirSync(join(appDir, d.name), { withFileTypes: true })) {
        if (s.isDirectory()) out.push(s.name);
      }
    } else {
      out.push(d.name);
    }
  }
  return out;
}

describe("RESERVED_SLUGS", () => {
  it("covers every top-level app route", () => {
    const missing = topLevelRoutes().filter((r) => !RESERVED_SLUGS.has(r));
    expect(missing).toEqual([]);
  });

  it("blocks official-looking words", () => {
    for (const w of ["pay", "support", "help", "pricing", "checkout", "cart"]) {
      expect(RESERVED_SLUGS.has(w)).toBe(true);
    }
  });
});
