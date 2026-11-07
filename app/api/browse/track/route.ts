import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const ID_RE = /^[a-z0-9]{10,40}$/i;
const MAX_POSTS = 20;

type Body = { kind?: unknown; slug?: unknown; postId?: unknown; postIds?: unknown };

/** The Lagos calendar day (UTC+1, no daylight saving). */
const today = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

async function bump(storeId: string, kind: string, postId: string, by: number) {
  const day = today();
  await prisma.$executeRaw`
    INSERT INTO "BrowseStat" ("id", "storeId", "day", "kind", "postId", "count")
    VALUES (${randomUUID()}, ${storeId}, ${day}::date, ${kind}, ${postId}, ${by})
    ON CONFLICT ("storeId", "day", "kind", "postId")
    DO UPDATE SET "count" = "BrowseStat"."count" + ${by}`;
}

/**
 * Counts Browse activity for the seller's Insights page: profile views, post impressions and shares.
 * Best effort: it always answers 204 so a tracking hiccup never shows up in someone's browser. Views by
 * the store's own owner are not counted.
 */
export async function POST(req: Request) {
  const done = new NextResponse(null, { status: 204 });
  try {
    if (BOT.test(req.headers.get("user-agent") ?? "")) return done;
    const rate = await checkRateLimit(`browse-track:${getClientIp(req.headers)}`, 120, 60_000);
    if (!rate.allowed) return done;
    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || typeof body.kind !== "string") return done;

    const session = await auth().catch(() => null);
    const ownStoreId = session?.user?.id
      ? (await prisma.store.findFirst({ where: { business: { userId: session.user.id } }, select: { id: true } }))?.id ?? null
      : null;

    if (body.kind === "PROFILE_VIEW" || (body.kind === "SHARE" && typeof body.slug === "string" && !body.postId)) {
      if (typeof body.slug !== "string" || !SLUG_RE.test(body.slug)) return done;
      const store = await prisma.store.findUnique({ where: { slug: body.slug }, select: { id: true, status: true } });
      if (!store || store.status !== "ACTIVE" || store.id === ownStoreId) return done;
      await bump(store.id, body.kind, "", 1);
      return done;
    }

    if (body.kind === "SHARE" && typeof body.postId === "string" && ID_RE.test(body.postId)) {
      const post = await prisma.browsePost.findUnique({ where: { id: body.postId }, select: { id: true, storeId: true, status: true } });
      if (!post || post.status !== "PUBLISHED" || post.storeId === ownStoreId) return done;
      await bump(post.storeId, "SHARE", post.id, 1);
      return done;
    }

    if (body.kind === "POST_IMPRESSION" && Array.isArray(body.postIds)) {
      const ids = [...new Set(body.postIds.filter((x): x is string => typeof x === "string" && ID_RE.test(x)))].slice(0, MAX_POSTS);
      if (!ids.length) return done;
      const posts = await prisma.browsePost.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, select: { id: true, storeId: true } });
      for (const p of posts) {
        if (p.storeId === ownStoreId) continue;
        await bump(p.storeId, "POST_IMPRESSION", p.id, 1);
      }
    }
  } catch {
    // Analytics must never break anything.
  }
  return done;
}
