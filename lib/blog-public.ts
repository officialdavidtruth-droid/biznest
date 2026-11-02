import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { BLOG_PAGE_SIZE, BLOG_PLUGIN_KEY, excerptFor, formatPostDate, publicPostWhere } from "@/lib/blog";

/** True when this store has the Blog app installed on a plan that includes it. Visitors see the blog only then. */
export const isBlogActive = cache(async (storeId: string): Promise<boolean> => {
  const e = await getPluginEntitlement(storeId, BLOG_PLUGIN_KEY).catch(() => null);
  return !!e && e.allowed && e.installed;
});

const card = {
  id: true, title: true, slug: true, excerpt: true, body: true, featuredImage: true, featuredImageAlt: true,
  authorName: true, publishedAt: true, readingMinutes: true, tags: true, isFeatured: true,
  category: { select: { name: true, slug: true } },
} as const;

export type BlogCard = {
  id: string; title: string; slug: string; excerpt: string | null; body: string; featuredImage: string | null; featuredImageAlt: string | null;
  authorName: string; publishedAt: Date | null; readingMinutes: number; tags: string[]; isFeatured: boolean; category: { name: string; slug: string } | null;
};

export async function getBlogIndex(storeId: string, opts: { page?: number; category?: string; tag?: string; q?: string }) {
  const now = new Date();
  const base = publicPostWhere(storeId, now);
  const category = opts.category ? await prisma.blogCategory.findUnique({ where: { storeId_slug: { storeId, slug: opts.category } }, select: { id: true, name: true, slug: true } }) : null;
  const q = opts.q?.trim().slice(0, 80);
  const where = {
    ...base,
    ...(category ? { categoryId: category.id } : opts.category ? { id: "__none__" } : {}),
    ...(opts.tag ? { tags: { has: opts.tag } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { excerpt: { contains: q, mode: "insensitive" as const } }, { body: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const total = await prisma.blogPost.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1) || 1), totalPages);
  const filtered = !!(category || opts.tag || q || opts.category);
  // The newest pinned post leads the first page of the unfiltered feed.
  const featured = !filtered && page === 1 ? await prisma.blogPost.findFirst({ where: { ...base, isFeatured: true }, orderBy: { publishedAt: "desc" }, select: card }) : null;
  const posts = await prisma.blogPost.findMany({
    where: featured ? { ...where, id: { not: featured.id } } : where,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (page - 1) * BLOG_PAGE_SIZE, take: featured ? BLOG_PAGE_SIZE - 1 : BLOG_PAGE_SIZE, select: card,
  });
  const [categories, tagRows] = await Promise.all([
    prisma.blogCategory.findMany({ where: { storeId, posts: { some: base } }, orderBy: { name: "asc" }, select: { name: true, slug: true, _count: { select: { posts: { where: base } } } } }),
    prisma.blogPost.findMany({ where: base, select: { tags: true }, take: 300 }),
  ]);
  const tagCounts = new Map<string, number>();
  for (const r of tagRows) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);
  return { posts: posts as BlogCard[], featured: featured as BlogCard | null, page, totalPages, total, category, categories: categories.map((c) => ({ name: c.name, slug: c.slug, count: c._count.posts })), tags };
}

export async function getBlogPost(storeId: string, postSlug: string) {
  const now = new Date();
  const post = await prisma.blogPost.findFirst({
    where: { ...publicPostWhere(storeId, now), slug: postSlug },
    select: { ...card, seoTitle: true, seoDescription: true, updatedAt: true, categoryId: true },
  });
  if (!post) return null;
  const or = [...(post.categoryId ? [{ categoryId: post.categoryId }] : []), ...(post.tags.length ? [{ tags: { hasSome: post.tags } }] : [])];
  const [related, newer, older] = await Promise.all([
    or.length ? prisma.blogPost.findMany({ where: { ...publicPostWhere(storeId, now), id: { not: post.id }, OR: or }, orderBy: { publishedAt: "desc" }, take: 3, select: card }) : Promise.resolve([]),
    prisma.blogPost.findFirst({ where: { ...publicPostWhere(storeId, now), publishedAt: { gt: post.publishedAt!, lte: now } }, orderBy: { publishedAt: "asc" }, select: { title: true, slug: true } }),
    prisma.blogPost.findFirst({ where: { ...publicPostWhere(storeId, now), publishedAt: { lt: post.publishedAt! } }, orderBy: { publishedAt: "desc" }, select: { title: true, slug: true } }),
  ]);
  return { post: post as BlogCard & { seoTitle: string | null; seoDescription: string | null; updatedAt: Date }, related: related as BlogCard[], newer, older };
}

export type BlogCardView = { id: string; title: string; slug: string; excerpt: string; image: string | null; imageAlt: string; date: string; minutes: number; author: string; category: { name: string; slug: string } | null; tags: string[] };

/** Plain, serialisable data for the storefront cards (dates are formatted on the server so they match on the client). */
export function toCardView(p: BlogCard): BlogCardView {
  return {
    id: p.id, title: p.title, slug: p.slug, excerpt: excerptFor(p), image: p.featuredImage, imageAlt: p.featuredImageAlt || p.title,
    date: formatPostDate(p.publishedAt), minutes: p.readingMinutes, author: p.authorName, category: p.category, tags: p.tags,
  };
}
