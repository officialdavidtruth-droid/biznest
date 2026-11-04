import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { BLOG_PAGE_SIZE, excerptFor, formatPostDate, publicArticleWhere } from "@/lib/blog";

/** Posts are core to every store (no app install needed). Kept as a function so callers stay unchanged. */
export const isBlogActive = cache(async (_storeId: string): Promise<boolean> => true);

const card = {
  id: true, title: true, handle: true, excerpt: true, body: true, imageUrl: true, imageAlt: true,
  authorName: true, publishedAt: true, readingMinutes: true, tags: true,
  blog: { select: { title: true, handle: true } },
} as const;

export type ArticleCard = {
  id: string; title: string; handle: string; excerpt: string | null; body: string; imageUrl: string | null; imageAlt: string | null;
  authorName: string; publishedAt: Date | null; readingMinutes: number; tags: string[]; blog: { title: string; handle: string };
};

/** A blog by handle, or the store's first blog (the one /blog shows) when no handle is given. */
export async function resolveBlog(storeId: string, handle?: string | null) {
  if (handle) return prisma.blog.findUnique({ where: { storeId_handle: { storeId, handle } }, select: { id: true, title: true, handle: true } });
  return prisma.blog.findFirst({ where: { storeId }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, handle: true } });
}

export async function getBlogIndex(storeId: string, opts: { blog?: string | null; page?: number; tag?: string; q?: string }) {
  const blog = await resolveBlog(storeId, opts.blog);
  if (!blog) return null;
  const now = new Date();
  const base = { ...publicArticleWhere(storeId, now), blogId: blog.id };
  const q = opts.q?.trim().slice(0, 80);
  const where = {
    ...base,
    ...(opts.tag ? { tags: { has: opts.tag } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { excerpt: { contains: q, mode: "insensitive" as const } }, { body: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const total = await prisma.article.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1) || 1), totalPages);
  const [articles, blogs, tagRows] = await Promise.all([
    prisma.article.findMany({ where, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (page - 1) * BLOG_PAGE_SIZE, take: BLOG_PAGE_SIZE, select: card }),
    prisma.blog.findMany({ where: { storeId, articles: { some: publicArticleWhere(storeId, now) } }, orderBy: { createdAt: "asc" }, select: { title: true, handle: true } }),
    prisma.article.findMany({ where: base, select: { tags: true }, take: 300 }),
  ]);
  const tagCounts = new Map<string, number>();
  for (const r of tagRows) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);
  return { blog, blogs, articles: articles as ArticleCard[], page, totalPages, total, tags };
}

export async function getArticle(storeId: string, blogHandleOrNull: string | null, articleHandle: string) {
  const blog = await resolveBlog(storeId, blogHandleOrNull);
  if (!blog) return null;
  const now = new Date();
  const pub = { ...publicArticleWhere(storeId, now), blogId: blog.id };
  const article = await prisma.article.findFirst({
    where: { ...pub, handle: articleHandle },
    select: { ...card, seoTitle: true, seoDescription: true, updatedAt: true },
  });
  if (!article) return null;
  const [tagged, newer, older] = await Promise.all([
    article.tags.length ? prisma.article.findMany({ where: { ...pub, id: { not: article.id }, tags: { hasSome: article.tags } }, orderBy: { publishedAt: "desc" }, take: 3, select: card }) : Promise.resolve([]),
    prisma.article.findFirst({ where: { ...pub, publishedAt: { gt: article.publishedAt!, lte: now } }, orderBy: { publishedAt: "asc" }, select: { title: true, handle: true } }),
    prisma.article.findFirst({ where: { ...pub, publishedAt: { lt: article.publishedAt! } }, orderBy: { publishedAt: "desc" }, select: { title: true, handle: true } }),
  ]);
  const related = tagged.length ? tagged : await prisma.article.findMany({ where: { ...pub, id: { not: article.id } }, orderBy: { publishedAt: "desc" }, take: 3, select: card });
  return { blog, article: article as ArticleCard & { seoTitle: string | null; seoDescription: string | null; updatedAt: Date }, related: related as ArticleCard[], newer, older };
}

export type ArticleCardView = { id: string; title: string; handle: string; blogHandle: string; excerpt: string; image: string | null; imageAlt: string; date: string; minutes: number; author: string; tags: string[] };

/** Plain, serialisable data for the storefront cards (dates are formatted on the server so they match on the client). */
export function toCardView(p: ArticleCard): ArticleCardView {
  return {
    id: p.id, title: p.title, handle: p.handle, blogHandle: p.blog.handle, excerpt: excerptFor(p), image: p.imageUrl, imageAlt: p.imageAlt || p.title,
    date: formatPostDate(p.publishedAt), minutes: p.readingMinutes, author: p.authorName, tags: p.tags,
  };
}
