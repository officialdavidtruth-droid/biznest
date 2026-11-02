import { prisma } from "@/lib/prisma";
import { absoluteUrl, storeUrl } from "@/lib/seo";
import { excerptFor, publicPostWhere } from "@/lib/blog";
import { isBlogActive } from "@/lib/blog-public";

export const revalidate = 600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// RSS 2.0 feed of the latest posts. On a custom domain this is https://mystore.com/blog/rss.xml.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, marketingOnly: true, seoNoIndex: true, customDomain: true, customDomainStatus: true } });
  if (!store || store.status !== "ACTIVE" || store.marketingOnly || store.seoNoIndex || !(await isBlogActive(store.id))) return new Response("Not found", { status: 404 });

  const posts = await prisma.blogPost.findMany({
    where: publicPostWhere(store.id), orderBy: { publishedAt: "desc" }, take: 30,
    select: { title: true, slug: true, excerpt: true, body: true, publishedAt: true, authorName: true, featuredImage: true, category: { select: { name: true } }, tags: true },
  });
  const home = storeUrl(store, "/blog");
  const items = posts.map((p) => {
    const link = storeUrl(store, `/blog/${p.slug}`);
    const img = absoluteUrl(p.featuredImage);
    return [
      "    <item>",
      `      <title>${esc(p.title)}</title>`,
      `      <link>${esc(link)}</link>`,
      `      <guid isPermaLink="true">${esc(link)}</guid>`,
      p.publishedAt ? `      <pubDate>${p.publishedAt.toUTCString()}</pubDate>` : "",
      `      <dc:creator>${esc(p.authorName)}</dc:creator>`,
      ...(p.category ? [`      <category>${esc(p.category.name)}</category>`] : []),
      ...p.tags.map((t) => `      <category>${esc(t)}</category>`),
      `      <description>${esc(excerptFor(p, 300))}</description>`,
      ...(img ? [`      <enclosure url="${esc(img)}" type="image/jpeg" length="0" />`] : []),
      "    </item>",
    ].filter(Boolean).join("\n");
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>${esc(store.name)} Blog</title>\n    <link>${esc(home)}</link>\n    <description>${esc(`News, guides and stories from ${store.name}.`)}</description>\n    <language>en</language>\n    <atom:link href="${esc(storeUrl(store, "/blog/rss.xml"))}" rel="self" type="application/rss+xml" />\n${items.join("\n")}\n  </channel>\n</rss>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
