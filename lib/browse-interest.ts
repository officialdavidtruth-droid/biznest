import "server-only";
import { prisma } from "@/lib/prisma";
import { extractHashtags } from "@/lib/browse";
import { decayed, EMPTY_INTERESTS, MAX_WEIGHT, type Interests } from "@/lib/browse-foryou";

type Kind = "STORE" | "CATEGORY" | "TAG";
type PostLike = { storeId: string; category?: string | null; caption?: string | null };

async function bump(viewerKey: string, kind: Kind, key: string, add: number) {
  const now = new Date();
  const row = await prisma.browseInterest.findUnique({ where: { viewerKey_kind_key: { viewerKey, kind, key } }, select: { weight: true, updatedAt: true } });
  const weight = Math.min(MAX_WEIGHT, (row ? decayed(row.weight, row.updatedAt, now) : 0) + add);
  await prisma.browseInterest.upsert({
    where: { viewerKey_kind_key: { viewerKey, kind, key } },
    create: { viewerKey, kind, key, weight },
    update: { weight, updatedAt: now },
  });
}

/** Records that this viewer showed interest in a post. Never throws and never blocks the caller for long. */
export async function recordPostInterest(viewerKey: string | null | undefined, post: PostLike, strength: number) {
  if (!viewerKey || !(strength > 0)) return;
  try {
    const tags = extractHashtags(post.caption ?? "").slice(0, 4);
    await Promise.all([
      bump(viewerKey, "STORE", post.storeId, strength),
      post.category ? bump(viewerKey, "CATEGORY", post.category, strength) : Promise.resolve(),
      ...tags.map((t) => bump(viewerKey, "TAG", t, strength * 0.7)),
    ]);
    if (Math.random() < 0.01) {
      // Housekeeping: forget interests nobody has touched for three months.
      await prisma.browseInterest.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
    }
  } catch {
    /* personalisation is best effort */
  }
}

export async function recordTagInterest(viewerKey: string | null | undefined, tag: string, strength: number) {
  if (!viewerKey) return;
  try { await bump(viewerKey, "TAG", tag, strength); } catch { /* best effort */ }
}

export async function recordCategoryInterest(viewerKey: string | null | undefined, category: string, strength: number) {
  if (!viewerKey) return;
  try { await bump(viewerKey, "CATEGORY", category, strength); } catch { /* best effort */ }
}

export async function recordStoreInterest(viewerKey: string | null | undefined, storeId: string, strength: number) {
  if (!viewerKey) return;
  try { await bump(viewerKey, "STORE", storeId, strength); } catch { /* best effort */ }
}

/** This viewer's current interests, decayed. Follows count as a standing interest in that store. */
export async function loadInterests(viewerKey: string | null | undefined): Promise<Interests> {
  const out = EMPTY_INTERESTS();
  if (!viewerKey) return out;
  const now = new Date();
  const [rows, follows] = await Promise.all([
    prisma.browseInterest.findMany({ where: { viewerKey }, orderBy: { weight: "desc" }, take: 120, select: { kind: true, key: true, weight: true, updatedAt: true } }),
    prisma.browseFollow.findMany({ where: { viewerKey }, take: 200, select: { storeId: true } }),
  ]);
  for (const r of rows) {
    const w = decayed(r.weight, r.updatedAt, now);
    if (w < 0.2) continue;
    (r.kind === "STORE" ? out.stores : r.kind === "CATEGORY" ? out.categories : out.tags).set(r.key, w);
  }
  for (const f of follows) out.stores.set(f.storeId, (out.stores.get(f.storeId) ?? 0) + 6);
  return out;
}
