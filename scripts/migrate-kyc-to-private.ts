/**
 * One-off: move KYC documents uploaded BEFORE private storage (public
 * Cloudinary URLs under biznest/<userId>/...) into private "authenticated"
 * storage under biznest-kyc/<userId>/..., and rewrite the DB URLs.
 *
 *   npx tsx scripts/migrate-kyc-to-private.ts           # dry run (default)
 *   npx tsx scripts/migrate-kyc-to-private.ts --apply   # do it
 *
 * Needs DATABASE_URL and CLOUDINARY_* in the environment. Safe to re-run:
 * documents already private are skipped.
 */
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PUBLIC_RE = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?biznest\/([^/]+)\/(.+)$/;

async function moveToPrivate(url: string): Promise<string | null> {
  const m = PUBLIC_RE.exec(url);
  if (!m) return null; // already private, or not one of ours
  const [, resourceType, userId, rest] = m;
  const dot = rest.lastIndexOf(".");
  const name = resourceType === "raw" || dot === -1 ? rest : rest.slice(0, dot);
  const from = `biznest/${userId}/${name}`;
  const to = `biznest-kyc/${userId}/${name}`;
  console.log(`${APPLY ? "MOVE" : "would move"} ${from} -> ${to} (${resourceType})`);
  if (!APPLY) return `(dry-run)`;
  const res = (await cloudinary.uploader.rename(from, to, {
    resource_type: resourceType,
    type: "upload",
    to_type: "authenticated",
    overwrite: false,
    invalidate: true, // purge the CDN copy of the old public URL
  } as never)) as { secure_url: string };
  // Stored form: unsigned delivery URL (useless without a signature).
  const secureUrl = res.secure_url;
  return secureUrl.includes("/authenticated/") ? secureUrl : secureUrl.replace("/upload/", "/authenticated/");
}

async function main() {
  const businesses = await prisma.business.findMany({
    select: { id: true, registrationCertUrl: true, governmentIdUrl: true, selfieUrl: true, guarantors: { select: { id: true, governmentIdUrl: true } } },
  });
  let moved = 0;
  for (const b of businesses) {
    const data: { registrationCertUrl?: string; governmentIdUrl?: string; selfieUrl?: string } = {};
    for (const key of ["registrationCertUrl", "governmentIdUrl", "selfieUrl"] as const) {
      const v = b[key];
      if (!v) continue;
      const next = await moveToPrivate(v);
      if (next && APPLY) data[key] = next;
      if (next) moved++;
    }
    if (APPLY && Object.keys(data).length) await prisma.business.update({ where: { id: b.id }, data });
    for (const g of b.guarantors) {
      const next = await moveToPrivate(g.governmentIdUrl);
      if (next) moved++;
      if (next && APPLY) await prisma.guarantor.update({ where: { id: g.id }, data: { governmentIdUrl: next } });
    }
  }
  console.log(`${APPLY ? "Moved" : "Would move"} ${moved} document(s).`);
}

main().finally(() => prisma.$disconnect());
