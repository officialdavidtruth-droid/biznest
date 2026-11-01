import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Every folder under app/store/[slug] is a static route that beats /[pageSlug], so a custom
// page saved under that name can never load. Keep the reserved list in lib/actions/pages-constants.ts in sync.
describe("custom page reserved slugs", () => {
  it("covers every static store route folder except the six suggested pages", () => {
    const root = join(process.cwd(), "app/store/[slug]");
    const folders = readdirSync(root).filter((n) => statSync(join(root, n)).isDirectory() && !n.startsWith("["));
    const exempt = new Set(["about", "gallery", "faq", "blog", "contact", "policies"]);
    const src = readFileSync(join(process.cwd(), "lib/actions/pages-constants.ts"), "utf8");
    const missing = folders.filter((f) => !exempt.has(f) && !src.includes(`"${f}"`));
    expect(missing).toEqual([]);
  });
});
