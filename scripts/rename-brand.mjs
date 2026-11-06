#!/usr/bin/env node
/**
 * One-shot brand rename helper.
 *
 *   node scripts/rename-brand.mjs --to "Newname"                 # dry run: counts and a review list, changes nothing
 *   node scripts/rename-brand.mjs --to "Newname" --write         # rewrites visible "BizNest" text
 *   node scripts/rename-brand.mjs --to "Newname" --domain newname.ng --write   # also biznest.space -> newname.ng
 *
 * What it changes: the standalone word "BizNest" (so BizNestLogo, BizNestFooter etc. are left alone and
 * keep matching their file names) in source, content and docs.
 * What it never touches: node_modules, .next, .git, prisma/migrations (history must stay as it ran),
 * lockfiles, binaries, and anything lowercase (cookie/header names, package ids, storage keys, the APK name).
 * Lowercase "biznest" is listed at the end for you to review by hand (env vars, Vercel project, Android package id,
 * keystore, email sender addresses, DNS). Changing those needs matching changes outside the code.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const to = val("to");
const domain = val("domain");
const write = flag("write");
if (!to || /^--/.test(to)) { console.error('Usage: node scripts/rename-brand.mjs --to "Newname" [--domain newname.ng] [--write]'); process.exit(1); }
if (!/^[A-Za-z0-9][A-Za-z0-9 .&'-]{1,30}$/.test(to)) { console.error("Name looks odd. Use letters, numbers, spaces."); process.exit(1); }
if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { console.error("--domain must look like newname.ng"); process.exit(1); }

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", "coverage", "dist", "build", ".turbo"]);
const SKIP_PATHS = ["prisma/migrations"];
const SKIP_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.tsbuildinfo"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".css", ".html", ".txt", ".svg", ".xml", ".webmanifest", ".yml", ".yaml", ".sql"]);

const WORD = /\bBizNest\b/g;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !SKIP_PATHS.includes(rel)) walk(full); continue; }
    if (SKIP_FILES.has(e.name) || !TEXT_EXT.has(path.extname(e.name).toLowerCase())) continue;
    if (e.name.endsWith(".min.js") || rel === "scripts/rename-brand.mjs") continue;
    files.push({ full, rel });
  }
})(ROOT);

let total = 0, changedFiles = 0, domainHits = 0;
const byTop = {};
const lowercase = new Map();
for (const f of files) {
  let text;
  try { text = fs.readFileSync(f.full, "utf8"); } catch { continue; }
  const hits = (text.match(WORD) ?? []).length;
  const dHits = domain ? (text.match(/biznest\.space/g) ?? []).length : 0;
  for (const m of text.matchAll(/[A-Za-z0-9_.\-@/]*biznest[A-Za-z0-9_.\-]*/g)) {
    if (domain && m[0] === "biznest.space") continue;
    lowercase.set(m[0], (lowercase.get(m[0]) ?? 0) + 1);
  }
  if (!hits && !dHits) continue;
  total += hits; domainHits += dHits; changedFiles++;
  const top = f.rel.includes("/") ? f.rel.split("/")[0] : "(root files)";
  byTop[top] = (byTop[top] ?? 0) + hits + dHits;
  if (write) {
    let out = text.replace(WORD, to);
    if (domain) out = out.replace(/biznest\.space/g, domain);
    fs.writeFileSync(f.full, out);
  }
}

console.log(`${write ? "REWROTE" : "DRY RUN:"} ${total} "BizNest" in ${changedFiles} files -> "${to}"${domain ? `, ${domainHits} "biznest.space" -> "${domain}"` : ""}`);
console.log("By folder:", byTop);
const rows = [...lowercase.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
if (rows.length) {
  console.log("\nLeft untouched, review by hand (lowercase ids, env, hosts, file names):");
  for (const [k, n] of rows) console.log(`  ${String(n).padStart(4)}  ${k}`);
}
console.log("\nAlso change outside the code: domain + DNS, Vercel project, NEXT_PUBLIC_APP_URL / AUTH_URL, Resend sender domain, Google OAuth redirect URIs, payment gateway dashboards (Paystack, Flutterwave, Korapay), Cloudinary folder names, Android package id and keystore, social handles.");
if (!write) console.log("\nNothing was changed. Add --write to apply.");
