import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { loadInterests } from "@/lib/browse-interest";
import { forYouScore } from "@/lib/browse-foryou";
import { extractHashtags, sanitizeStickers, shortPersonName, type Sticker, BROWSE_PAGE_SIZE, decodeCursor, encodeCursor, isMogulStore, orderRings, popularityScore, spreadStores, toBio } from "@/lib/browse";

export type BrowsePostView = {
  id: string;
  kind: string;
  caption: string;
  images: string[];
  videoUrl: string | null;
  stickers: Sticker[];
  location: string | null;
  aiGenerated: boolean;
  tags: Array<{ kind: "store" | "user"; name: string; slug: string | null }>;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  saveCount: number;
  product: { id: string; name: string; price: number | null; currency: string; kind: "PRODUCT" | "SERVICE" } | null;
  store: { slug: string; name: string; logoUrl: string | null; category: string | null; city: string | null; verified: boolean; mogul: boolean };
};

export type BrowseCommentView = { id: string; authorName: string; body: string; createdAt: string; mine: boolean; hidden?: boolean; byStore?: boolean; pinned?: boolean };

export type FeedSort = "foryou" | "latest" | "popular";
export type FeedQuery = { videoOnly?: boolean; sort?: FeedSort; category?: string | null; cursor?: string | null; viewerKey?: string | null; limit?: number; storeIds?: string[] };
export type FeedPage = { posts: BrowsePostView[]; nextCursor: string | null };

const tagsInclude = { select: { tagStore: { select: { name: true, slug: true } }, tagUser: { select: { name: true } } }, take: 10 } as const;

const storeSelect = {
  slug: true, name: true, logoUrl: true,
  business: { select: { category: true, city: true, verificationBadge: true } },
  subscription: { select: { name: true } },
  subscriptionPastDueSince: true,
} as const;

type Row = {
  saveCount?: number;
  id: string; kind: string; caption: string; images: string[]; videoUrl?: string | null; stickers?: unknown; tagKind?: string; location?: string | null; aiGenerated?: boolean; tags?: Array<{ tagStore: { name: string; slug: string } | null; tagUser: { name: string | null } | null }>; createdAt: Date; likeCount: number; commentCount: number;
  productId: string | null; productName: string | null; productPrice: unknown; productCurrency: string | null;
  store: { slug: string; name: string; logoUrl: string | null; business: { category: string; city: string; verificationBadge: boolean } | null; subscription?: { name: string } | null; subscriptionPastDueSince?: Date | null };
};

export function toPostView(r: Row, liked: boolean, saved = false): BrowsePostView {
  return {
    id: r.id, kind: r.kind, caption: r.caption, images: r.images, videoUrl: r.videoUrl ?? null, stickers: sanitizeStickers(r.stickers), location: r.location ?? null, aiGenerated: !!r.aiGenerated,
    tags: (r.tags ?? []).flatMap((t): BrowsePostView["tags"] => (t.tagStore ? [{ kind: "store" as const, name: t.tagStore.name, slug: t.tagStore.slug }] : t.tagUser ? [{ kind: "user" as const, name: shortPersonName(t.tagUser.name), slug: null }] : [])),
    createdAt: r.createdAt.toISOString(),
    likeCount: r.likeCount, commentCount: r.commentCount, liked, saved, saveCount: r.saveCount ?? 0,
    product: r.productId && r.productName ? { id: r.productId, name: r.productName, price: r.productPrice == null ? null : Number(r.productPrice), currency: r.productCurrency ?? "NGN", kind: r.tagKind === "SERVICE" ? "SERVICE" : "PRODUCT" } : null,
    store: { slug: r.store.slug, name: r.store.name, logoUrl: r.store.logoUrl, category: r.store.business?.category ?? null, city: r.store.business?.city ?? null, verified: !!r.store.business?.verificationBadge, mogul: isMogulStore(r.store) },
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

async function savedSet(ids: string[], viewerKey?: string | null): Promise<Set<string>> {
  if (!viewerKey || ids.length === 0) return new Set();
  const rows = await prisma.browseSave.findMany({ where: { viewerKey, postId: { in: ids } }, select: { postId: true } });
  return new Set(rows.map((r) => r.postId));
}

export async function loadBrowseFeed(q: FeedQuery = {}): Promise<FeedPage> {
  const limit = Math.min(Math.max(q.limit ?? BROWSE_PAGE_SIZE, 1), 20);
  if (q.storeIds && q.storeIds.length === 0) return { posts: [], nextCursor: null };
  const base = publicPostWhere(q.category);
  const withStores = q.storeIds ? { ...base, storeId: { in: q.storeIds } } : base;
  const where = q.videoOnly ? { ...withStores, videoUrl: { not: null } } : withStores;

  if (q.sort === "foryou") {
    // Personal ranking: popular and fresh posts, lifted by what this viewer watches, likes, saves and searches.
    const offset = Math.max(0, Number(q.cursor) || 0);
    const include = { store: { select: storeSelect }, tags: tagsInclude, _count: { select: { reports: { where: { status: "OPEN" as const } } } } };
    const [interests, recent] = await Promise.all([
      loadInterests(q.viewerKey),
      prisma.browsePost.findMany({ where: { ...where, createdAt: { gte: new Date(Date.now() - 21 * 86_400_000) } }, orderBy: { createdAt: "desc" }, take: 150, include }),
    ]);
    // A young platform may have few recent posts; top up with older ones so the feed never runs dry.
    const pool = recent.length >= 40 ? recent : await prisma.browsePost.findMany({ where, orderBy: { createdAt: "desc" }, take: 150, include });
    const now = new Date();
    const scored = pool.map((p) => ({
      p,
      score: forYouScore({ id: p.id, storeId: p.storeId, category: p.store.business?.category ?? null, hashtags: extractHashtags(p.caption), createdAt: p.createdAt, likeCount: p.likeCount, commentCount: p.commentCount, saveCount: p.saveCount, shopTapCount: p.shopTapCount, openReports: p._count.reports, verified: !!p.store.business?.verificationBadge }, interests, now),
    }));
    const ranked = spreadStores(scored.sort((a, b) => b.score - a.score).map((x) => x.p));
    const slice = ranked.slice(offset, offset + limit);
    const ids = slice.map((p) => p.id);
    const [liked, saved] = await Promise.all([likedSet(ids, q.viewerKey), savedSet(ids, q.viewerKey)]);
    return { posts: slice.map((p) => toPostView(p as unknown as Row, liked.has(p.id), saved.has(p.id))), nextCursor: offset + limit < ranked.length ? String(offset + limit) : null };
  }

  if (q.sort === "popular") {
    // Rank the last two weeks in memory (bounded), page by offset.
    const offset = Math.max(0, Number(q.cursor) || 0);
    const since = new Date(Date.now() - 14 * 86_400_000);
    const pool = await prisma.browsePost.findMany({
      where: { ...where, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: { store: { select: storeSelect }, tags: tagsInclude, _count: { select: { reports: { where: { status: "OPEN" } } } } },
    });
    const now = new Date();
    const score = (p: (typeof pool)[number]) => popularityScore({ ...p, openReports: p._count.reports, verified: !!p.store.business?.verificationBadge }, now);
    const ranked = spreadStores([...pool].sort((a, b) => score(b) - score(a)));
    const slice = ranked.slice(offset, offset + limit);
    const ids = slice.map((p) => p.id);
    const [liked, saved] = await Promise.all([likedSet(ids, q.viewerKey), savedSet(ids, q.viewerKey)]);
    return { posts: slice.map((p) => toPostView(p as unknown as Row, liked.has(p.id), saved.has(p.id))), nextCursor: offset + limit < ranked.length ? String(offset + limit) : null };
  }

  const cur = decodeCursor(q.cursor);
  const rows = await prisma.browsePost.findMany({
    where: cur ? { ...where, OR: [{ createdAt: { lt: cur.createdAt } }, { createdAt: cur.createdAt, id: { lt: cur.id } }] } : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { store: { select: storeSelect }, tags: tagsInclude },
  });
  const page = rows.slice(0, limit);
  const pageIds = page.map((p) => p.id);
  const [liked, saved] = await Promise.all([likedSet(pageIds, q.viewerKey), savedSet(pageIds, q.viewerKey)]);
  return {
    posts: page.map((p) => toPostView(p as unknown as Row, liked.has(p.id), saved.has(p.id))),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}

/** Store ids a signed-in viewer follows (newest follow first, capped). */
export async function loadFollowedStoreIds(viewerKey: string): Promise<string[]> {
  const rows = await prisma.browseFollow.findMany({ where: { viewerKey }, orderBy: { createdAt: "desc" }, take: 500, select: { storeId: true } });
  return rows.map((r: { storeId: string }) => r.storeId);
}

/** The shops a viewer follows, for the Following page header. Only shops still public. */
export async function loadFollowedShops(viewerKey: string, limit = 24): Promise<DiscoverShop[]> {
  const rows = await prisma.browseFollow.findMany({
    where: { viewerKey, store: { status: "ACTIVE", business: { is: { searchVisible: true } } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 60),
    select: { store: { select: {
      slug: true, name: true, logoUrl: true, followerCount: true, subscriptionPastDueSince: true, subscription: { select: { name: true } },
      business: { select: { category: true, city: true, verificationBadge: true } },
      _count: { select: { browsePosts: { where: { status: "PUBLISHED" } } } },
    } } },
  });
  type R = { slug: string; name: string; logoUrl: string | null; followerCount: number; subscriptionPastDueSince: Date | null; subscription: { name: string } | null; business: { category: string; city: string; verificationBadge: boolean } | null; _count: { browsePosts: number } };
  return rows.map((x: { store: R }) => {
    const r = x.store;
    return { slug: r.slug, name: r.name, logoUrl: r.logoUrl, category: r.business?.category ?? null, city: r.business?.city ?? null, verified: !!r.business?.verificationBadge, mogul: isMogulStore(r), followerCount: Math.max(0, r.followerCount), postCount: r._count.browsePosts };
  });
}

export async function loadBrowsePost(id: string, viewerKey?: string | null): Promise<BrowsePostView | null> {
  const row = await prisma.browsePost.findFirst({ where: { id, ...publicPostWhere() }, include: { store: { select: storeSelect }, tags: tagsInclude } });
  if (!row) return null;
  const [liked, saved] = await Promise.all([likedSet([row.id], viewerKey), savedSet([row.id], viewerKey)]);
  return toPostView(row as unknown as Row, liked.has(row.id), saved.has(row.id));
}

/** Newest `take` comments, returned oldest-first, with a cursor to older ones. A pinned comment is listed first on the first page. */
export async function loadBrowseComments(postId: string, opts: { before?: string | null; viewerKey?: string | null; take?: number; includeHidden?: boolean } = {}) {
  const take = Math.min(opts.take ?? 20, 50);
  const cur = decodeCursor(opts.before);
  const visible = opts.includeHidden ? {} : { status: "VISIBLE" };
  const [rows, pinnedRow] = await Promise.all([
    prisma.browseComment.findMany({
      where: {
        postId, ...visible, pinned: false,
        ...(cur ? { OR: [{ createdAt: { lt: cur.createdAt } }, { createdAt: cur.createdAt, id: { lt: cur.id } }] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
    }),
    cur ? Promise.resolve(null) : prisma.browseComment.findFirst({ where: { postId, ...visible, pinned: true } }),
  ]);
  const page = rows.slice(0, take);
  const toView = (c: (typeof rows)[number]): BrowseCommentView => ({
    id: c.id, authorName: c.authorName, body: c.body, createdAt: c.createdAt.toISOString(),
    mine: !!opts.viewerKey && c.viewerKey === opts.viewerKey, hidden: c.status !== "VISIBLE", byStore: c.byStore, pinned: c.pinned,
  });
  const comments = page.reverse().map(toView);
  if (pinnedRow) comments.unshift(toView(pinnedRow));
  return { comments, nextCursor: rows.length > take ? encodeCursor(rows[take - 1]) : null };
}

export type PostReviews = { avg: number; count: number; photos: string[]; latest: Array<{ rating: number; comment: string; author: string; images: string[] }> };

/** Buyer reviews for the product or service a post points at, with photos first. Null when there are none. */
export async function loadPostReviews(storeId: string, kind: "PRODUCT" | "SERVICE", itemId: string): Promise<PostReviews | null> {
  const where = { storeId, ...(kind === "SERVICE" ? { serviceId: itemId } : { productId: itemId }) };
  const [agg, withPhotos, recent] = await Promise.all([
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
    prisma.review.findMany({ where: { ...where, NOT: { images: { equals: [] } } }, orderBy: { createdAt: "desc" }, take: 6, select: { images: true } }),
    prisma.review.findMany({ where: { ...where, comment: { not: null } }, orderBy: { createdAt: "desc" }, take: 3, select: { rating: true, comment: true, images: true, author: { select: { name: true } } } }),
  ]);
  if (agg._count === 0) return null;
  return {
    avg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
    count: agg._count,
    photos: withPhotos.flatMap((r) => r.images.slice(0, 1)).slice(0, 6),
    latest: recent.map((r) => ({ rating: r.rating, comment: (r.comment ?? "").slice(0, 220), author: shortPersonName(r.author.name ?? "Customer"), images: r.images.slice(0, 3) })),
  };
}

/** The viewer's saved posts, newest save first. */
export async function loadSavedPosts(viewerKey: string, cursor?: string | null, limit = 12): Promise<FeedPage> {
  const offset = Math.max(0, Number(cursor) || 0);
  const rows = await prisma.browseSave.findMany({
    where: { viewerKey, post: publicPostWhere() },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: offset, take: limit + 1,
    include: { post: { include: { store: { select: storeSelect }, tags: tagsInclude } } },
  });
  const page = rows.slice(0, limit);
  const liked = await likedSet(page.map((r) => r.postId), viewerKey);
  return { posts: page.map((r) => toPostView(r.post as unknown as Row, liked.has(r.postId), true)), nextCursor: rows.length > limit ? String(offset + limit) : null };
}

export type VendorPostView = {
  id: string; kind: string; caption: string; images: string[]; hasVideo: boolean; createdAt: string; status: string; hiddenReason: string | null;
  likeCount: number; commentCount: number; productName: string | null;
};

export async function loadVendorBrowse(storeId: string) {
  const [posts, last24h] = await Promise.all([
    prisma.browsePost.findMany({ where: { storeId, status: { not: "REMOVED" } }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.browsePost.count({ where: { storeId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  const views: VendorPostView[] = posts.map((p) => ({
    id: p.id, kind: p.kind, caption: p.caption, images: p.images, hasVideo: !!p.videoUrl, createdAt: p.createdAt.toISOString(), status: p.status, hiddenReason: p.hiddenReason,
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
  mogul?: boolean;
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
  store: { slug: string; name: string; logoUrl: string | null; business: { verificationBadge: boolean } | null; subscription?: { name: string } | null; subscriptionPastDueSince?: Date | null };
};

function ringsFrom(rows: StoryRow[], seen: Set<string>): StoryRing[] {
  const byStore = new Map<string, StoryRing>();
  for (const r of rows) {
    let ring = byStore.get(r.store.slug);
    if (!ring) {
      ring = { storeSlug: r.store.slug, storeName: r.store.name, logoUrl: r.store.logoUrl, verified: !!r.store.business?.verificationBadge, mogul: isMogulStore(r.store), allSeen: true, latestAt: r.createdAt.toISOString(), stories: [] };
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

const storyStoreSelect = { slug: true, name: true, logoUrl: true, business: { select: { verificationBadge: true } }, subscription: { select: { name: true } }, subscriptionPastDueSince: true } as const;

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
  id: string; slug: string; name: string; logoUrl: string | null; category: string | null; city: string | null; verified: boolean; mogul: boolean;
  bio: string; followerCount: number; following: boolean; postCount: number; likeCount: number;
};

export async function loadStoreProfile(slug: string, viewerKey?: string | null): Promise<StoreProfile | null> {
  const store = await prisma.store.findFirst({
    where: { slug, status: "ACTIVE", business: { is: { searchVisible: true } } },
    select: {
      id: true, slug: true, name: true, logoUrl: true, followerCount: true, subscriptionPastDueSince: true, subscription: { select: { name: true } },
      business: { select: { category: true, city: true, verificationBadge: true, description: true } },
    },
  });
  if (!store) return null;
  const [agg, follow] = await Promise.all([
    prisma.browsePost.aggregate({ where: { storeId: store.id, status: "PUBLISHED" }, _count: { _all: true }, _sum: { likeCount: true } }),
    viewerKey ? prisma.browseFollow.findUnique({ where: { storeId_viewerKey: { storeId: store.id, viewerKey } }, select: { id: true } }) : Promise.resolve(null),
  ]);
  return {
    id: store.id, slug: store.slug, name: store.name, logoUrl: store.logoUrl, category: store.business?.category ?? null, city: store.business?.city ?? null,
    verified: !!store.business?.verificationBadge, mogul: isMogulStore(store), bio: toBio(store.business?.description),
    followerCount: Math.max(0, store.followerCount), following: !!follow, postCount: agg._count._all, likeCount: agg._sum.likeCount ?? 0,
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

export type DiscoverShop = { slug: string; name: string; logoUrl: string | null; category: string | null; city: string | null; verified: boolean; mogul: boolean; followerCount: number; postCount: number };

/** Public shops, most active first. Fills the sidebar and the empty feed so a new visitor always has somewhere to go. */
export async function loadDiscoverShops(limit = 6): Promise<DiscoverShop[]> {
  const rows = await prisma.store.findMany({
    where: { status: "ACTIVE", business: { is: { searchVisible: true } } },
    orderBy: [{ followerCount: "desc" }, { browsePosts: { _count: "desc" } }, { createdAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 12),
    select: {
      slug: true, name: true, logoUrl: true, followerCount: true, subscriptionPastDueSince: true, subscription: { select: { name: true } },
      business: { select: { category: true, city: true, verificationBadge: true } },
      _count: { select: { browsePosts: { where: { status: "PUBLISHED" } } } },
    },
  });
  return rows.map((r: { slug: string; name: string; logoUrl: string | null; followerCount: number; subscriptionPastDueSince: Date | null; subscription: { name: string } | null; business: { category: string; city: string; verificationBadge: boolean } | null; _count: { browsePosts: number } }) => ({
    slug: r.slug, name: r.name, logoUrl: r.logoUrl, category: r.business?.category ?? null, city: r.business?.city ?? null, verified: !!r.business?.verificationBadge, mogul: isMogulStore(r), followerCount: Math.max(0, r.followerCount), postCount: r._count.browsePosts,
  }));
}


/** Newest public posts whose caption uses #tag. The database narrows by text; the exact-word check happens here so #tag doesn't match #tagging. */
export async function loadHashtagPosts(tag: string, viewerKey?: string | null, limit = 40): Promise<BrowsePostView[]> {
  const clean = tag.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 30);
  if (clean.length < 2) return [];
  const rows = await prisma.browsePost.findMany({
    where: { ...publicPostWhere(), caption: { contains: `#${clean}`, mode: "insensitive" } },
    orderBy: { createdAt: "desc" }, take: limit * 3, include: { store: { select: storeSelect }, tags: tagsInclude },
  });
  const exact = new RegExp(`#${clean}(?![\\p{L}\\p{N}_])`, "iu");
  const hits = rows.filter((r: { caption: string }) => exact.test(r.caption)).slice(0, limit);
  const liked = await likedSet(hits.map((h: { id: string }) => h.id), viewerKey);
  return hits.map((h: { id: string }) => toPostView(h as unknown as Row, liked.has(h.id)));
}


/** Hashtags used most in the last 30 days, with how many posts use each. Cached for 10 minutes. */
export const loadTrendingTags = unstable_cache(
  async (limit = 12): Promise<{ tag: string; posts: number }[]> => {
    const rows = await prisma.browsePost.findMany({
      where: { ...publicPostWhere(), createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, caption: { contains: "#" } },
      select: { caption: true },
      orderBy: { createdAt: "desc" },
      take: 800,
    });
    const counts = new Map<string, number>();
    for (const r of rows as { caption: string }[]) for (const t of new Set(extractHashtags(r.caption))) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag, posts]) => ({ tag, posts }));
  },
  ["browse-trending-tags"],
  { revalidate: 600 },
);
