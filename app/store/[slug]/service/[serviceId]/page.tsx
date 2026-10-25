import { getCanonicalBusinessType } from "@/lib/business-identity";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { resolveStoreTheme } from "@/lib/template-themes";
import { CatalogItemDetail } from "@/components/storefront/catalog-item-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { NO_INDEX, absoluteUrl as absUrl, cleanDescription, storeUrl } from "@/lib/seo";
import { TrackViewItem } from "@/components/storefront/store-tracking";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; serviceId: string }> }): Promise<Metadata> {
  const { slug, serviceId } = await params;
  // Same visibility rules as the page itself: an unpublished service or an
  // inactive store must not leak its name/description/image through metadata.
  const service = await prisma.service.findFirst({
    where: { id: serviceId, isPublished: true, store: { slug, status: "ACTIVE" } },
    select: { name: true, description: true, images: true, store: { select: { slug: true, name: true, logoUrl: true, bannerUrl: true, customDomain: true, customDomainStatus: true, seoNoIndex: true } } },
  });
  if (!service) return { title: "Not found", robots: { index: false, follow: false } };

  const storeName = service.store.name;
  const title = `${service.name} — ${storeName}`;
  const description = cleanDescription(service.description) ?? `Book ${service.name} with ${storeName} on BizNest.`;
  const canonical = storeUrl(service.store, `/service/${serviceId}`);

  // OG/Twitter crawlers need absolute URLs; there is no metadataBase, so build
  // the origin from the host that served this request (works for custom domains).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const abs = (src?: string | null) => {
    if (!src) return undefined;
    if (/^https?:\/\//i.test(src)) return src;
    return host ? `${proto}://${host}${src.startsWith("/") ? "" : "/"}${src}` : undefined;
  };
  const image = abs(service.images?.[0]) ?? abs(service.store.bannerUrl) ?? abs(service.store.logoUrl);

  return {
    title,
    description,
    robots: service.store.seoNoIndex ? NO_INDEX : undefined,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: storeName, locale: "en_NG", ...(image ? { images: [{ url: image, alt: service.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string; serviceId: string }> }) {
  const { slug, serviceId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const service = await prisma.service.findFirst({ where: { id: serviceId, storeId: store.id, isPublished: true }, include: {
      category: true,
      // Display list only: the newest reviews with a first name and any merchant reply.
      reviews: {
        orderBy: { createdAt: "desc" }, take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { name: true } }, response: { select: { content: true } } },
      },
    },
  });
  if (!service) notFound();
  // Rating and count must cover ALL reviews, not just the 20 fetched for display.
  const reviewAgg = await prisma.review.aggregate({ where: { serviceId: service.id }, _avg: { rating: true }, _count: { _all: true } });
  const reviewStats = { average: reviewAgg._avg.rating ?? null, count: reviewAgg._count._all };
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  const url = storeUrl(store, `/service/${service.id}`);
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: cleanDescription(service.description, 500),
    ...(service.images.length ? { image: service.images.map((i) => absUrl(i)).filter(Boolean) } : {}),
    ...(service.category?.name ? { serviceType: service.category.name } : {}),
    url,
    provider: { "@type": "Organization", name: store.name, url: storeUrl(store) },
    offers: { "@type": "Offer", url, price: Number(service.price).toFixed(2), priceCurrency: service.currency, availability: "https://schema.org/InStock" },
    ...(reviewStats.count > 0 && reviewStats.average
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(reviewStats.average.toFixed(1)), reviewCount: reviewStats.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: store.name, item: storeUrl(store) },
      { "@type": "ListItem", position: 2, name: service.name, item: url },
    ],
  };
  return <><JsonLd data={store.seoNoIndex ? [] : [serviceLd, breadcrumbLd]} /><TrackViewItem slug={slug} currency={service.currency} item={{ id: service.id, name: service.name, price: Number(service.price) }} /><CatalogItemDetail store={{...store,sellsProducts:store.business?.sellsProducts??true} as any} slug={slug} service={service} reviewStats={reviewStats} theme={theme} businessCategory={getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType })} /></>;
}
