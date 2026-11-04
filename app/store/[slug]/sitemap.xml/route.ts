import { prisma } from "@/lib/prisma";
import { buildSitemapXml, storeUrl, type SitemapEntry } from "@/lib/seo";
import { publicArticleWhere } from "@/lib/blog";
import { isBlogActive } from "@/lib/blog-public";

export const revalidate = 3600;

// Per-store sitemap. On a vendor's custom domain this is what
// https://mystore.com/sitemap.xml resolves to (middleware rewrites it to
// /store/<slug>/sitemap.xml); on biznest.space it is /<slug>/sitemap.xml.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true, marketingOnly: true, seoNoIndex: true, customDomain: true, customDomainStatus: true, updatedAt: true },
  });
  if (!store || store.status !== "ACTIVE" || store.marketingOnly || store.seoNoIndex) {
    return new Response("Not found", { status: 404 });
  }

  const [products, services, categories] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id, isPublished: true }, select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 20000 }),
    prisma.service.findMany({ where: { storeId: store.id, isPublished: true }, select: { id: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 10000 }),
    prisma.category.findMany({ where: { storeId: store.id, isActive: true }, select: { id: true, slug: true, updatedAt: true }, take: 5000 }),
  ]);

  const blogPosts = (await isBlogActive(store.id))
    ? await prisma.article.findMany({ where: publicArticleWhere(store.id), select: { handle: true, updatedAt: true, blog: { select: { handle: true } } }, orderBy: { publishedAt: "desc" }, take: 5000 })
    : [];

  const entries: SitemapEntry[] = [
    { url: storeUrl(store), lastModified: store.updatedAt, changeFrequency: "daily", priority: 1 },
    ...categories.map((c) => ({ url: storeUrl(store, `/category/${c.slug || c.id}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: storeUrl(store, `/product/${p.id}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...services.map((s) => ({ url: storeUrl(store, `/service/${s.id}`), lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...(blogPosts.length ? [{ url: storeUrl(store, `/blogs/${blogPosts[0].blog.handle}`), lastModified: blogPosts[0].updatedAt, changeFrequency: "daily" as const, priority: 0.6 }] : []),
    ...blogPosts.map((b) => ({ url: storeUrl(store, `/blogs/${b.blog.handle}/${b.handle}`), lastModified: b.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];

  return new Response(buildSitemapXml(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
