import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { extractHashtags } from "@/lib/browse";

// Rebuilt at most hourly so new stores/listings are discovered quickly
// without hitting the database on every crawler request.
export const revalidate = 3600;

// The sitemap protocol allows 50,000 URLs per file; stay safely under it.
const LIMITS = { stores: 5000, products: 25000, services: 10000, categories: 5000, posts: 5000, tags: 1000 };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/templates`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/terms`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/seller-agreement`, changeFrequency: "monthly", priority: 0.2 },
  ];

  try {
    // Only stores that are live, public, have a storefront, and are served
    // from biznest.space. Stores on a verified custom domain publish their
    // own sitemap at https://<their-domain>/sitemap.xml (a sitemap may only
    // list URLs on its own host).
    const storeWhere = {
      status: "ACTIVE" as const,
      marketingOnly: false,
      seoNoIndex: false,
      NOT: { customDomainStatus: "VERIFIED" as const },
    };

    const [stores, products, services, categories, posts] = await Promise.all([
      prisma.store.findMany({
        where: storeWhere,
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: LIMITS.stores,
      }),
      prisma.product.findMany({
        where: { isPublished: true, store: storeWhere },
        select: { id: true, updatedAt: true, store: { select: { slug: true } } },
        orderBy: { updatedAt: "desc" },
        take: LIMITS.products,
      }),
      prisma.service.findMany({
        where: { isPublished: true, store: storeWhere },
        select: { id: true, updatedAt: true, store: { select: { slug: true } } },
        orderBy: { updatedAt: "desc" },
        take: LIMITS.services,
      }),
      prisma.category.findMany({
        where: { isActive: true, store: storeWhere },
        select: { id: true, slug: true, updatedAt: true, store: { select: { slug: true } } },
        orderBy: { updatedAt: "desc" },
        take: LIMITS.categories,
      }),
      prisma.browsePost.findMany({
        where: { status: "PUBLISHED", store: storeWhere },
        select: { id: true, caption: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
        take: LIMITS.posts,
      }),
    ]);

    // Browse: every store profile, recent posts, and every hashtag that has posts.
    const tagCount = new Map<string, { n: number; at: Date }>();
    for (const p of posts) {
      entries.push({ url: `${SITE_URL}/browse/p/${p.id}`, lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.5 });
      for (const t of extractHashtags(p.caption)) {
        const cur = tagCount.get(t);
        tagCount.set(t, { n: (cur?.n ?? 0) + 1, at: cur && cur.at > p.updatedAt ? cur.at : p.updatedAt });
      }
    }
    for (const [t, v] of [...tagCount].sort((a, b) => b[1].n - a[1].n).slice(0, LIMITS.tags)) {
      entries.push({ url: `${SITE_URL}/browse/tag/${encodeURIComponent(t)}`, lastModified: v.at, changeFrequency: "daily", priority: 0.5 });
    }
    for (const s of stores) {
      entries.push({ url: `${SITE_URL}/browse/s/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "daily", priority: 0.6 });
    }

    for (const s of stores) {
      entries.push({ url: `${SITE_URL}/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "daily", priority: 0.9 });
    }
    for (const c of categories) {
      if (!c.store) continue;
      entries.push({ url: `${SITE_URL}/${c.store.slug}/category/${c.slug || c.id}`, lastModified: c.updatedAt, changeFrequency: "weekly", priority: 0.6 });
    }
    for (const p of products) {
      entries.push({ url: `${SITE_URL}/${p.store.slug}/product/${p.id}`, lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.7 });
    }
    for (const s of services) {
      entries.push({ url: `${SITE_URL}/${s.store.slug}/service/${s.id}`, lastModified: s.updatedAt, changeFrequency: "weekly", priority: 0.7 });
    }
  } catch {
    // Database unreachable (e.g. during a build): still serve the static pages.
  }

  return entries;
}
