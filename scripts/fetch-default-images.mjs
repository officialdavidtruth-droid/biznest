// Downloads the default hotel stock photos into public/defaults/ so they can be self-hosted.
// Usage:  node scripts/fetch-default-images.mjs
// Then set NEXT_PUBLIC_DEFAULT_IMAGE_BASE_URL=/defaults  (see lib/default-images.ts)
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";

const files = ["lib/hotel-content.ts", "components/storefront/theluso-hotel.tsx"];
const ids = new Set();
for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/photo-[0-9a-f]+-[0-9a-f]+/g)) ids.add(m[0]);

mkdirSync("public/defaults", { recursive: true });
let ok = 0, failed = 0;
for (const id of ids) {
  const out = `public/defaults/${id}.jpg`;
  if (existsSync(out)) { ok++; continue; }
  try {
    const res = await fetch(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1800&q=85`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    ok++; console.log("saved", out);
  } catch (e) { failed++; console.error("FAILED", id, e.message); }
}
console.log(`${ok} ok, ${failed} failed of ${ids.size}`);
process.exitCode = failed ? 1 : 0;
