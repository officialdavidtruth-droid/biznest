import { prisma } from "@/lib/prisma";
import { BROWSE_PAGE_SIZE, decodeCursor, encodeCursor, orderRings, popularityScore } from "@/lib/browse";

export type BrowsePostView = {
  id: string;
  kind: string;
  caption: string;
  images: string[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  product: { id: string; name: string; price: number | null; currency: string } | null;
  store: { slug: string; name: string; logoUrl: string | null; category: string | null; city: string | null; verified: boolean };
};

export type BrowseCommentView = { id: string; authorName: string; body: string; createdAt: string; mine: boolean; hidden?: boolean };

export type FeedSort = "latest" | "popular";
export type FeedQuery = { sort?: FeedSort; category?: string | null; cursor?: string | null; viewerKey?: string | null; limit?: number };
export type FeedPage = { posts: BrowsePostView[]; nextCursor: string | null };

const storeSelect = {
  slug: true, name: true, logoUrl: true,
  business: { select: { category: true, city: true, verificationBadge: true } },
} as const;

type Row = {
  id: string; kind: string; caption: string; images: string[]; createdAt: Date; likeCount: number; commentCount: number;
  productId: string | null; productName: string | null; productPrice: unknown; productCurrency: string | null;
  store: { slug: string; name: string; logoUrl: string | null; business: { category: string; city: string; verificationBadge: boolean } | null };
};

export function toPostView(r: Row, liked: boolean): BrowsePostView {
  return {
    id: r.id, kind: r.kind, caption: r.caption, images: r.images, createdAt: r.createdAt.toISOString(),
    likeCount: r.likeCount, commentCount: r.commentCount, liked,
    product: r.productId && r.productName ? { id: r.productId, name: r.productName, price: r.productPrice == null ? null : Number(r.productPrice), currency: r.productCurrency ?? "NGN" } : null,
    store: { slug: r.store.slug, name: r.store.name, logoUrl: r.store.logoUrl, category: r.store.business?.category ?? null, city: r.store.business?.city ?? null, verified: !!r.store.business?.verificationBadge },
  };
}

/** Only live posts from active stores that have not opted out of public discovery. */
export const publicPostWhere = (category?: string | null) => ({
  status: "PUBLISHED",
  store: { status: "ACTIVE" as const, business: { is: { searchVisible: true, ...(category ? { category } : {}) } } },
});

async function likedSet(ids: string[], viewerKey?: string | null): Promise<Set<string>> {
  if (!viewerKey || ids.length === 0) return new Set();
  const rows = await prisma.browseLike.findMany({ where: { viewerKey, postId: { in: ids } }, select: { postId: true } });
  return new Set(rows.map((r) => r.postId));
}

export async function loadBrowseFeed(q: FeedQuery = {}): Promise<FeedPage> {
  const limit = Math.min(Math.max(q.limit ?? BROWSE_PAGE_SIZE, 1), 20);
  const where = publicPostWhere(q.category);

  if (q.sort === "popular") {
    // Rank the last two weeks in memory (bounded), page by offset.
    const offset = Math.max(0, Number(q.cursor) || 0);
    const since = new Date(Date.now() - 14 * 86_400_000);
    const pool = await prisma.browsePost.findMany({
      where: { ...where, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: { store: { select: storeSelect } },
    });
    const now = new Date();
    const ranked = pool.sort((a, b) => popularityScore(b, now) - popularityScore(a, now));
    const slice = ranked.slice(offset, offset + limit);
    const liked = await likedSet(slice.map((p) => p.id), q.viewerKey);
    return { posts: slice.map((p) => toPostView(p as unknown as Row, liked.has(p.id))), nextCursor: offset + limit < ranked.length ? String(offset + limit) : null };
  }

  const cur = decodeCursor(q.cursor);
  const rows = await prisma.browsePost.findMany({
    where: cur ? { ...where, OR: [{ createdAt: { lt: cur.createdAt } }, { createdAt: cur.createdAt, id: { lt: cur.id } }] } : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { store: { select: storeSelect } },
  });
  const page = rows.slice(0, limit);
  const liked = await likedSet(page.map((p) => p.id), q.viewerKey);
  return {
    posts: page.map((p) => toPostView(p as unknown as Row, liked.has(p.id))),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}

export async function loadBrowsePost(id: string, viewerKey?: string | null): Promise<BrowsePostView | null> {
  const row = await prisma.browsePost.findFirst({ where: { id, ...publicPostWhere() }, include: { store: { select: storeSelect } } });
  if (!row) return null;
  const liked = await likedSet([row.id], viewerKey);
  return toPostView(row as unknown as Row, liked.has(row.id));
}

/** Newest `take` comments, returned oldest-first, with a cursor to older ones. */
export async function loadBrowseComments(postId: string, opts: { before?: string | null; viewerKey?: string | null; take?: number; includeHidden?: boolean } = {}) {
  const take = Math.min(opts.take ?? 20, 50);
  const cur = decodeCursor(opts.before);
  const rows = await prisma.browseComment.findMany({
    where: {
      postId,
      ...(opts.includeHidden ? {} : { status: "VISIBLE" }),
      ...(cur ? { OR: [{ createdAt: { lt: cur.createdAt } }, { createdAt: cur.createdAt, id: { lt: cur.id } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
  });
  const page = rows.slice(0, take);
  const comments: BrowseCommentView[] = page.reverse().map((c) => ({
    id: c.id, authorName: c.authorName, body: c.body, createdAt: c.createdAt.toISOString(),
    mine: !!opts.viewerKey && c.viewerKey === opts.viewerKey, hidden: c.status !== "VISIBLE",
  }));
  return { comments, nextCursor: rows.length > take ? encodeCursor(rows[take - 1]) : null };
}

export type VendorPostView = {
  id: string; kind: string; caption: string; images: string[]; createdAt: string; status: string; hiddenReason: string | null;
  likeCount: number; commentCount: number; productName: string | null;
};

export async function loadVendorBrowse(storeId: string) {
  const [posts, last24h] = await Promise.all([
    prisma.browsePost.findMany({ where: { storeId, status: { not: "REMOVED" } }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.browsePost.count({ where: { storeId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  const views: VendorPostView[] = posts.map((p) => ({
    id: p.id, kind: p.kind, caption: p.caption, images: p.images, createdAt: p.createdAt.toISOString(), status: p.status, hiddenReason: p.hiddenReason,
    likeCount: p.likeCount, commentCount: p.commentCount, productName: p.productName,
  }));
  const totals = posts.reduce((a, p) => ({ likes: a.likes + p.likeCount, comments: a.comments + p.commentCount }), { likes: 0, comments: 0 });
  return { posts: views, postedToday: last24h, totals };
}

export async function loadBrowseCategories(): Promise<string[]> {
  const rows = await prisma.business.findMany({
    where: { searchVisible: true, store: { is: { status: "ACTIVE", browsePosts: { some: { status: "PUBLISHED" } } } } },
    select: { category: true },
    distinct: ["category"],
    take: 30,
  });
  return rows.map((r) => r.category).sort();
}

// ------------------------------------------------------------------ stories

export type StoryView = {
  id: string;
  kind: string;
  imageUrl: string | null;
  text: string | null;
  bgColor: string | null;
  createdAt: string;
  seen: boolean;
  /** Set on sponsored items: the AdCampaign id and the call-to-action text. */
  ad?: { id: string; cta: string };
  product: { id: string; name: string; price: number | null; currency: string } | null;
};
export type StoryRing = {
  storeSlug: string;
  storeName: string;
  logoUrl: string | null;
  verified: boolean;
  allSeen: boolean;
  latestAt: string;
  sponsored?: boolean;
  stories: StoryView[];
};

const liveStoryWhere = (extra: Record<string, unknown> = {}) => ({
  status: "ACTIVE",
  expiresAt: { gt: new Date() },
  store: { status: "ACTIVE" as const, business: { is: { searchVisible: true } } },
  ...extra,
});

type StoryRow = {
  id: string; kind: string; imageUrl: string | null; text: string | null; bgColor: string | null; createdAt: Date;
  productId: string | null; productName: string | null; productPrice: unknown; productCurrency: string | null;
  store: { slug: string; name: string; logoUrl: string | null; business: { verificationBadge: boolean } | null };
};

function ringsFrom(rows: StoryRow[], seen: Set<string>): StoryRing[] {
  const byStore = new Map<string, StoryRing>();
  for (const r of rows) {
    let ring = byStore.get(r.store.slug);
    if (!ring) {
      ring = { storeSlug: r.store.slug, storeName: r.store.name, logoUrl: r.store.logoUrl, verified: !!r.store.business?.verificationBadge, allSeen: true, latestAt: r.createdAt.toISOString(), stories: [] };
      byStore.set(r.store.slug, ring);
    }
    const isSeen = seen.has(r.id);
    if (!isSeen) ring.allSeen = false;
    if (r.createdAt.toISOString() > ring.latestAt) ring.latestAt = r.createdAt.toISOString();
    ring.stories.push({
      id: r.id, kind: r.kind, imageUrl: r.imageUrl, text: r.text, bgColor: r.bgColor, createdAt: r.createdAt.toISOString(), seen: isSeen,
      product: r.productId && r.productName ? { id: r.productId, name: r.productName, price: r.productPrice == null ? null : Number(r.productPrice), currency: r.productCurrency ?? "NGN" } : null,
    });
  }
  return [...byStore.values()];
}

async function seenSet(ids: string[], viewerKey?: string | null) {
  if (!viewerKey || ids.length === 0) return new Set<string>();
  const rows = await prisma.browseStoryView.findMany({ where: { viewerKey, storyId: { in: ids } }, select: { storyId: true } });
  return new Set<string>(rows.map((r: { storyId: string }) => r.storyId));
}

const storyStoreSelect = { slug: true, name: true, logoUrl: true, business: { select: { verificationBadge: true } } } as const;

/** The ring row above the feed. */
export async function loadStoryRings(viewerKey?: string | null, limit = 30): Promise<StoryRing[]> {
  const rows = await prisma.browseStory.findMany({
    where: liveStoryWhere(),
    orderBy: { createdAt: "asc" },
    take: 400,
    include: { store: { select: storyStoreSelect } },
  });
  const seen = await seenSet(rows.map((r) => r.id), viewerKey);
  return orderRings(ringsFrom(rows as unknown as StoryRow[], seen)).slice(0, limit);
}

export async function loadStoreStories(storeId: string, viewerKey?: string | null): Promise<StoryRing | null> {
  const rows = await prisma.browseStory.findMany({
    where: liveStoryWhere({ storeId }),
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { store: { select: storyStoreSelect } },
  });
  if (rows.length === 0) return null;
  const seen = await seenSet(rows.map((r) => r.id), viewerKey);
  return ringsFrom(rows as unknown as StoryRow[], seen)[0] ?? null;
}

// ------------------------------------------------------------- store profile

export type StoreProfile = {
  id: string; slug: string; name: string; logoUrl: string | null; category: string | null; city: string | null; verified: boolean;
  postCount: number; likeCount: number;
};

export async function loadStoreProfile(slug: string): Promise<StoreProfile | null> {
  const store = await prisma.store.findFirst({
    where: { slug, status: "ACTIVE", business: { is: { searchVisible: true } } },
    select: { id: true, slug: true, name: true, logoUrl: true, business: { select: { category: true, city: true, verificationBadge: true } } },
  });
  if (!store) return null;
  const agg = await prisma.browsePost.aggregate({ where: { storeId: store.id, status: "PUBLISHED" }, _count: { _all: true }, _sum: { likeCount: true } });
  return {
    id: store.id, slug: store.slug, name: store.name, logoUrl: store.logoUrl, category: store.business?.category ?? null, city: store.business?.city ?? null,
    verified: !!store.business?.verificationBadge, postCount: agg._count._all, likeCount: agg._sum.likeCount ?? 0,
  };
}

export type GridPost = { id: string; image: string | null; caption: string; likeCount: number; commentCount: number; multi: boolean; product: boolean };

export async function loadStorePosts(storeId: string, cursor?: string | null, limit = 24): Promise<{ posts: GridPost[]; nextCursor: string | null }> {
  const cur = decodeCursor(cursor);
  const rows = await prisma.browsePost.findMany({
    where: { storeId, status: "PUBLISHED", ...(cur ? { OR: [{ createdAt: { lt: cur.createdAt } }, { createdAt: cur.createdAt, id: { lt: cur.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    posts: page.map((p) => ({ id: p.id, image: p.images[0] ?? null, caption: p.caption, likeCount: p.likeCount, commentCount: p.commentCount, multi: p.images.length > 1, product: !!p.productId })),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}

export type VendorStoryView = { id: string; kind: string; imageUrl: string | null; text: string | null; bgColor: string | null; createdAt: string; expiresAt: string; viewCount: number; live: boolean };

export async function loadVendorStories(storeId: string): Promise<VendorStoryView[]> {
  const rows = await prisma.browseStory.findMany({ where: { storeId, status: "ACTIVE", createdAt: { gte: new Date(Date.now() - 3 * 86_400_000) } }, orderBy: { createdAt: "desc" }, take: 30 });
  const now = Date.now();
  return rows.map((s) => ({ id: s.id, kind: s.kind, imageUrl: s.imageUrl, text: s.text, bgColor: s.bgColor, createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString(), viewCount: s.viewCount, live: s.expiresAt.getTime() > now }));
}

// ------------------------------------------------------------------ discover

export type DiscoverShop = { slug: string; name: string; logoUrl: string | null; category: string | null; city: string | null; verified: boolean; postCount: number };

/** Public shops, most active first. Fills the sidebar and the empty feed so a new visitor always has somewhere to go. */
export async function loadDiscoverShops(limit = 6): Promise<DiscoverShop[]> {
  const rows = await prisma.store.findMany({
    where: { status: "ACTIVE", business: { is: { searchVisible: true } } },
    orderBy: [{ browsePosts: { _count: "desc" } }, { createdAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 12),
    select: {
      slug: true, name: true, logoUrl: true,
      business: { select: { category: true, city: true, verificationBadge: true } },
      _count: { select: { browsePosts: { where: { status: "PUBLISHED" } } } },
    },
  });
  return rows.map((r: { slug: string; name: string; logoUrl: string | null; business: { category: string; city: string; verificationBadge: boolean } | null; _count: { browsePosts: number } }) => ({
    slug: r.slug, name: r.name, logoUrl: r.logoUrl, category: r.business?.category ?? null, city: r.business?.city ?? null, verified: !!r.business?.verificationBadge, postCount: r._count.browsePosts,
  }));
}
