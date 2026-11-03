/**
 * Generates the gallery thumbnail for every template by screenshotting the real /template-preview/<name> route,
 * so a card shows exactly what the storefront renders.
 *
 *   npm run thumbnails:generate              screenshot only templates whose inputs changed
 *   npm run thumbnails:generate -- --force   screenshot everything
 *   npm run thumbnails:generate -- --only="Maison — Hotel & Stay"
 *   npm run thumbnails:check                 no browser; exit 1 if any thumbnail is missing or stale (for CI)
 *
 * Needs a running app: THUMBNAIL_BASE_URL (default http://localhost:3000).
 *
 * "Stale" means the hash of a template's definition (theme tokens, renderer kind) plus the source of the
 * renderer files below no longer matches the manifest. Changing a theme, or any renderer, regenerates the images.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { TEMPLATE_REGISTRY } from "@/lib/template-registry";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public/template-reference-previews/generated");
const PUBLIC_PREFIX = "/template-reference-previews/generated";
const MANIFEST = path.join(ROOT, "lib/template-thumbnails.generated.json");
const BASE_URL = (process.env.THUMBNAIL_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Anything that changes how a template's homepage looks. Keep in step with app/template-preview/[name]/page.tsx.
const RENDER_SOURCES = [
  "app/template-preview/[name]/page.tsx",
  "components/storefront/builder-renderer.tsx",
  "components/storefront/legacy-template-renderer.tsx",
  "components/storefront/signature-screenshot-home.tsx",
  "components/storefront/theluso-hotel.tsx",
  "components/storefront/example-store.tsx",
  "components/storefront/hero-variants.tsx",
  "components/storefront/reference-homes.tsx",
  "components/storefront/hotel-reference-homes.tsx",
  "components/storefront/store-footer.tsx",
  "components/storefront/store-menu.tsx",
  "lib/template-builder-config.ts",
  "lib/storefront/resolve-renderer.ts",
  "lib/storefront/signature-renderers.ts",
  "lib/hotel-skin.ts",
];

type Manifest = { version: 1; items: Record<string, { file: string; hash: string }> };

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);

const slugify = (name: string) =>
  name.normalize("NFKD").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function renderSourceHash(): Promise<string> {
  const h = createHash("sha256");
  for (const rel of RENDER_SOURCES) {
    try { h.update(rel).update(await readFile(path.join(ROOT, rel))); }
    catch (e: any) { if (e?.code !== "ENOENT") throw e; console.warn(`  (skipping missing render source: ${rel})`); }
  }
  return h.digest("hex");
}

async function readManifest(): Promise<Manifest> {
  try { return JSON.parse(await readFile(MANIFEST, "utf8")) as Manifest; }
  catch { return { version: 1, items: {} }; }
}

async function main() {
  const sourceHash = await renderSourceHash();
  const manifest = await readManifest();
  const all = TEMPLATE_REGISTRY.map((t) => ({
    name: t.name,
    file: `${slugify(t.name)}.jpg`,
    hash: createHash("sha256").update(sourceHash).update(stable({ name: t.name, theme: t.theme, renderer: t.renderer, home: t.home })).digest("hex").slice(0, 16),
  }));

  const slugs = new Set<string>();
  for (const t of all) {
    if (slugs.has(t.file)) throw new Error(`Two templates map to the same thumbnail file: ${t.file}`);
    slugs.add(t.file);
  }

  const selected = ONLY ? all.filter((t) => t.name === ONLY) : all;
  if (ONLY && !selected.length) throw new Error(`No template named "${ONLY}"`);

  const existing = new Set(await readdir(OUT_DIR).catch(() => [] as string[]));
  const stale = selected.filter((t) => FORCE || manifest.items[t.name]?.hash !== t.hash || !existing.has(t.file));

  if (CHECK) {
    if (!stale.length) { console.log(`All ${selected.length} template thumbnails are up to date.`); return; }
    console.error(`${stale.length} of ${selected.length} template thumbnails are missing or stale:`);
    for (const t of stale) console.error(`  - ${t.name}`);
    console.error("Run: npm run thumbnails:generate");
    process.exit(1);
  }

  if (!stale.length) { console.log(`Nothing to do: all ${selected.length} thumbnails are current. Use --force to redo them.`); return; }

  const { chromium } = await import("playwright");
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  // Laid out as a 1280x800 desktop viewport, captured at 0.5x => 640x400 files (about 2x the card's display size).
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5, reducedMotion: "reduce" });
  const failures: string[] = [];

  for (const t of stale) {
    const url = `${BASE_URL}/template-preview/${encodeURIComponent(t.name)}`;
    const page = await context.newPage();
    try {
      const res = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
      if (!res?.ok()) throw new Error(`HTTP ${res?.status()}`);
      // Fonts and above-the-fold images, but never hang on a slow third-party image.
      await Promise.race([
        page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
        }),
        page.waitForTimeout(15_000),
      ]);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT_DIR, t.file), type: "jpeg", quality: 78 });
      manifest.items[t.name] = { file: `${PUBLIC_PREFIX}/${t.file}`, hash: t.hash };
      console.log(`  ok   ${t.name}`);
    } catch (e: any) {
      failures.push(t.name);
      console.error(`  FAIL ${t.name}: ${e?.message ?? e}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();

  // Drop entries and files for templates that no longer exist, so the folder can't accumulate orphans.
  if (!ONLY) {
    const names = new Set(all.map((t) => t.name));
    for (const n of Object.keys(manifest.items)) if (!names.has(n)) delete manifest.items[n];
    for (const f of await readdir(OUT_DIR)) if (f.endsWith(".jpg") && !slugs.has(f)) await rm(path.join(OUT_DIR, f));
  }

  manifest.items = Object.fromEntries(Object.entries(manifest.items).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  if (failures.length) { console.error(`\n${failures.length} template(s) failed; their previous thumbnails (if any) were kept.`); process.exit(1); }
  console.log(`\nWrote ${stale.length} thumbnail(s) to ${path.relative(ROOT, OUT_DIR)}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
