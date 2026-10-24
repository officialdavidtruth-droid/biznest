import { prisma } from "@/lib/prisma";
import { STORE_PRIVATE_PATHS, storeUrl } from "@/lib/seo";

export const revalidate = 3600;

// robots.txt for a vendor's custom domain (https://mystore.com/robots.txt is
// rewritten here by middleware). Crawlers only read robots.txt at a host's
// root, so on biznest.space the platform-wide app/robots.ts is what applies.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { slug: true, status: true, marketingOnly: true, seoNoIndex: true, customDomain: true, customDomainStatus: true },
  });
  if (!store) return new Response("Not found", { status: 404 });

  const hidden = store.status !== "ACTIVE" || store.marketingOnly || store.seoNoIndex;
  const lines = hidden
    ? ["User-agent: *", "Disallow: /"]
    : ["User-agent: *", "Allow: /", ...STORE_PRIVATE_PATHS.map((p) => `Disallow: ${p}`), "Disallow: /api/", "", `Sitemap: ${storeUrl(store, "/sitemap.xml")}`];

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
