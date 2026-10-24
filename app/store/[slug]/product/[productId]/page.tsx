import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveStoreTheme } from "@/lib/template-themes";
import { ProductDetail } from "@/components/storefront/product-detail";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { JsonLd } from "@/components/seo/json-ld";
import { NO_INDEX, absoluteUrl, availability, cleanDescription, storeUrl } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  // Same visibility rules as the page: unpublished products / inactive stores must not leak via metadata.
  const product = await prisma.product.findFirst({
    where: { id: productId, isPublished: true, store: { slug, status: "ACTIVE" } },
    select: { name: true, description: true, images: true, category: { select: { name: true } }, store: { select: { slug: true, name: true, logoUrl: true, bannerUrl: true, customDomain: true, customDomainStatus: true, seoNoIndex: true } } },
  });
  if (!product) return { title: "Not found", robots: NO_INDEX };

  const title = `${product.name} — ${product.store.name}`;
  const description = cleanDescription(product.description) ?? `Buy ${product.name} from ${product.store.name} on BizNest.`;
  const canonical = storeUrl(product.store, `/product/${productId}`);
  const image = absoluteUrl(product.images?.[0]) ?? absoluteUrl(product.store.bannerUrl) ?? absoluteUrl(product.store.logoUrl);
  return {
    title,
    description,
    robots: product.store.seoNoIndex ? NO_INDEX : undefined,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description, siteName: product.store.name, locale: "en_NG", ...(image ? { images: [{ url: image, alt: product.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const product = await prisma.product.findFirst({ where: { id: productId, storeId: store.id, isPublished: true }, include: { category: true, inventory: true, variants: { where: { isActive: true }, select: { id: true, label: true, optionValues: true, price: true, quantity: true, images: true } } } });
  if (!product) notFound();
  const relatedRows = await prisma.product.findMany({ where: { storeId: store.id, isPublished: true, id: { not: product.id } }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, name: true, price: true, currency: true, images: true } });
  void recordStoreVisit(store.id, `/${slug}/product/${productId}`);
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  const inStock = product.type !== "PHYSICAL" || (product.hasVariants ? product.variants.some(v => v.quantity > 0) : !product.inventory || product.inventory.quantity > 0);
  const url = storeUrl(store, `/product/${product.id}`);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: cleanDescription(product.description, 500),
    ...(product.images.length ? { image: product.images.map((i) => absoluteUrl(i)).filter(Boolean) } : {}),
    ...(product.category?.name ? { category: product.category.name } : {}),
    brand: { "@type": "Brand", name: store.name },
    url,
    offers: {
      "@type": "Offer",
      url,
      price: Number(product.price).toFixed(2),
      priceCurrency: product.currency,
      availability: availability(inStock),
      seller: { "@type": "Organization", name: store.name, url: storeUrl(store) },
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: store.name, item: storeUrl(store) },
      ...(product.category ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: storeUrl(store, `/category/${product.category.id}`) }] : []),
      { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name, item: url },
    ],
  };
  return <><JsonLd data={store.seoNoIndex ? [] : [productLd, breadcrumbLd]}/><main style={{minHeight:"100vh",background:theme.bg,color:theme.ink,fontFamily:theme.font,padding:"3rem 1.25rem 4rem"}}><ProductDetail storeSlug={slug} productId={product.id} name={product.name} price={Number(product.price)} compareAtPrice={product.compareAtPrice ? Number(product.compareAtPrice) : null} currency={product.currency} images={product.images} description={product.description} categoryName={product.category?.name ?? null} type={product.type} rentalUnit={product.rentalPeriodUnit} inStock={inStock} variants={product.variants.map(v => ({ id: v.id, label: v.label, optionValues: v.optionValues as Record<string,string>, price: v.price ? Number(v.price) : null, quantity: v.quantity, images: v.images }))} accent={theme.accent} ink={theme.ink} radius={theme.radius} related={relatedRows.map(r => ({ id: r.id, name: r.name, price: Number(r.price), currency: r.currency, image: r.images[0] ?? null }))}/></main></>;
}
