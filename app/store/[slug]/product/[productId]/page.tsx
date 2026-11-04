import { prisma } from "@/lib/prisma";
import { formatShipsOn, preorderSpotsLeft } from "@/lib/preorder";
import { preorderUnitsTaken } from "@/lib/preorder-server";
import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import type { Metadata } from "next";
import { resolveStoreTheme } from "@/lib/template-themes";
import { ProductDetail } from "@/components/storefront/product-detail";
import { writeStoreVisit } from "@/lib/store-visit";
import { getClientIp } from "@/lib/rate-limit";
import { JsonLd } from "@/components/seo/json-ld";
import { NO_INDEX, absoluteUrl, availability, cleanDescription, storeUrl } from "@/lib/seo";
import { TrackViewItem } from "@/components/storefront/store-tracking";
import { buildSystemSlots } from "@/components/storefront/system-slots";
import { StorefrontShell } from "@/components/storefront/storefront-shell";

// Cached per request, so generateMetadata and the page share one set of queries
// instead of each hitting the database for the same store and product.
const loadStore = cache((slug: string) => prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } }));
const loadProduct = cache((storeId: string, productId: string) =>
  prisma.product.findFirst({
    where: { id: productId, storeId, isPublished: true, archivedAt: null },
    include: { category: true, inventory: true, variants: { where: { isActive: true }, select: { id: true, label: true, optionValues: true, price: true, quantity: true, images: true } } },
  }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  // Same visibility rules as the page: unpublished products / inactive stores must not leak via metadata.
  const store = await loadStore(slug);
  const product = store && store.status === "ACTIVE" ? await loadProduct(store.id, productId) : null;
  if (!store || !product) return { title: "Not found", robots: NO_INDEX };

  const title = `${product.name} — ${store.name}`;
  const description = cleanDescription(product.description) ?? `Buy ${product.name} from ${store.name} on BizNest.`;
  const canonical = storeUrl(store, `/product/${productId}`);
  const image = absoluteUrl(product.images?.[0]) ?? absoluteUrl(store.bannerUrl) ?? absoluteUrl(store.logoUrl);
  return {
    title,
    description,
    robots: store.seoNoIndex ? NO_INDEX : undefined,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description, siteName: store.name, locale: "en_NG", ...(image ? { images: [{ url: image, alt: product.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const store = await loadStore(slug);
  if (!store || store.status !== "ACTIVE") notFound();
  // The related query doesn't depend on the product row (the id filter uses the URL id), so run both together.
  const [product, relatedRows] = await Promise.all([
    loadProduct(store.id, productId),
    prisma.product.findMany({ where: { storeId: store.id, isPublished: true, archivedAt: null, id: { not: productId } }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, name: true, price: true, currency: true, images: true } }),
  ]);
  if (!product) notFound();
  // Read request headers now: request APIs aren't available inside after().
  // after() keeps the write alive after the response is sent; a bare un-awaited
  // promise can be killed when the serverless function finishes.
  const reqHeaders = await headers();
  const visit = { storeId: store.id, path: `/${slug}/product/${productId}`, ip: getClientIp(reqHeaders), referrer: reqHeaders.get("referer") };
  after(() => writeStoreVisit(visit));
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  const inStock = product.type !== "PHYSICAL" || (product.hasVariants ? product.variants.some(v => v.quantity > 0) : !product.inventory || product.inventory.quantity > 0);
  const isPreorder = product.type === "PHYSICAL" && product.preorderEnabled;
  const preorderTaken = isPreorder && product.preorderLimit != null ? await preorderUnitsTaken(product.id) : 0;
  const preorderView = isPreorder ? { shipsOn: formatShipsOn(product.preorderShipsOn), spotsLeft: preorderSpotsLeft(product.preorderLimit, preorderTaken) } : null;
  const url = storeUrl(store, `/product/${product.id}`);
  // A variant with no price of its own uses the product price (same rule as the page and checkout).
  const offerPrices = product.variants.length > 0 ? product.variants.map((v) => (v.price != null ? Number(v.price) : Number(product.price))) : [Number(product.price)];
  const offerLow = Math.min(...offerPrices);
  const offerHigh = Math.max(...offerPrices);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: cleanDescription(product.description, 500),
    ...(product.images.length ? { image: product.images.map((i) => absoluteUrl(i)).filter(Boolean) } : {}),
    ...(product.category?.name ? { category: product.category.name } : {}),
    ...(!product.hasVariants && product.inventory?.sku ? { sku: product.inventory.sku } : {}),
    url,
    offers: {
      "@type": offerLow === offerHigh ? "Offer" : "AggregateOffer",
      url,
      ...(offerLow === offerHigh ? { price: offerLow.toFixed(2) } : { lowPrice: offerLow.toFixed(2), highPrice: offerHigh.toFixed(2), offerCount: product.variants.length }),
      priceCurrency: product.currency,
      availability: availability(inStock, isPreorder && preorderView?.spotsLeft !== 0),
      seller: { "@type": "Organization", name: store.name, url: storeUrl(store) },
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: store.name, item: storeUrl(store) },
      ...(product.category ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: storeUrl(store, `/category/${product.category.slug || product.category.id}`) }] : []),
      { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name, item: url },
    ],
  };
  const slots = await buildSystemSlots(store, "product", { text: theme.ink, accent: theme.accent, primary: theme.accent, line: `${theme.ink}22`, radius: 8, headingFont: theme.font });
  return <><JsonLd data={store.seoNoIndex ? [] : [productLd, breadcrumbLd]}/><TrackViewItem slug={slug} currency={product.currency} item={{ id: product.id, name: product.name, price: Number(product.price) }}/><StorefrontShell store={store} slug={slug} theme={theme}><main style={{minHeight:"100vh",background:theme.bg,color:theme.ink,fontFamily:theme.font,padding:"3rem 1.25rem 4rem"}}>{slots.top}<ProductDetail storeSlug={slug} productId={product.id} name={product.name} price={Number(product.price)} compareAtPrice={product.compareAtPrice ? Number(product.compareAtPrice) : null} currency={product.currency} images={product.images} description={product.description} detailedDescription={typeof (product.attributes as Record<string, unknown> | null)?.detailedDescription === "string" ? ((product.attributes as Record<string, unknown>).detailedDescription as string) : ""} categoryName={product.category?.name ?? null} type={product.type} rentalUnit={product.rentalPeriodUnit} inStock={inStock || isPreorder} preorder={preorderView} stock={product.type === "PHYSICAL" && !product.hasVariants ? (product.inventory?.quantity ?? null) : null} variants={product.variants.map(v => ({ id: v.id, label: v.label, optionValues: v.optionValues as Record<string,string>, price: v.price ? Number(v.price) : null, quantity: v.quantity, images: v.images }))} accent={theme.accent} ink={theme.ink} bg={theme.bg} radius={theme.radius} related={relatedRows.map(r => ({ id: r.id, name: r.name, price: Number(r.price), currency: r.currency, image: r.images[0] ?? null }))}/>{slots.bottom}</main></StorefrontShell></>;
}
