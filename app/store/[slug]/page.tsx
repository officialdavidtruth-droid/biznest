import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreForSlug, renderStorefront } from "@/components/storefront/storefront-runtime";
import { JsonLd } from "@/components/seo/json-ld";
import { NO_INDEX, absoluteUrl, cleanDescription, parseKeywords, storeUrl } from "@/lib/seo";

/** schema.org type that best matches the store's business category. */
function schemaTypeFor(category?: string | null): string {
  const c = (category ?? "").toLowerCase();
  if (/hotel|lodg|guest ?house|hospitality|apartment|shortlet/.test(c)) return "LodgingBusiness";
  if (/restaurant|food|cafe|bakery|catering|bar|kitchen/.test(c)) return "FoodEstablishment";
  if (/beauty|salon|spa|barber/.test(c)) return "HealthAndBeautyBusiness";
  if (/real ?estate|property/.test(c)) return "RealEstateAgent";
  return "LocalBusiness";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreForSlug(slug);
  if (!store || store.status !== "ACTIVE" || store.marketingOnly) return { robots: NO_INDEX };

  const place = [store.business?.city, store.business?.state].filter(Boolean).join(", ");
  const category = store.business?.category;
  // Default title: "<Name> — <Category> in <City, State>" (unique + keyword-rich) unless the owner wrote their own.
  const title = store.seoTitle?.trim() || [store.name, [category, place && `in ${place}`].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
  const description =
    store.seoDescription?.trim() ||
    cleanDescription(store.business?.description) ||
    cleanDescription(`Shop ${store.name}${place ? ` in ${place}` : ""} on BizNest. Browse products and services, book online and pay securely.`);
  const canonical = store.seoCanonicalUrl?.trim() || storeUrl(store);
  const image = absoluteUrl(store.seoOgImage) ?? absoluteUrl(store.bannerUrl) ?? absoluteUrl(store.logoUrl);

  return {
    title,
    description,
    keywords: parseKeywords(store.seoKeywords),
    robots: store.seoNoIndex ? NO_INDEX : undefined,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, siteName: store.name, title, description, locale: "en_NG", ...(image ? { images: [{ url: image, alt: store.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreForSlug(slug);
  if (!store || store.status !== "ACTIVE") notFound();

  const url = storeUrl(store);
  const social = (store.socialLinks && typeof store.socialLinks === "object" ? store.socialLinks : {}) as Record<string, unknown>;
  const sameAs = Object.values(social).filter((v): v is string => typeof v === "string" && /^https?:\/\//i.test(v));
  const country = store.business?.country;
  const hasAddress = store.business?.city || store.business?.state || country;
  const logo = absoluteUrl(store.logoUrl);
  const image = absoluteUrl(store.bannerUrl) ?? logo;
  const rating = store.business?.avgRating;
  const reviewCount = store.business?.reviewCount ?? 0;

  const businessLd = {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(store.business?.category),
    "@id": `${url}#business`,
    name: store.name,
    url,
    description: cleanDescription(store.business?.description, 300),
    ...(logo ? { logo } : {}),
    ...(image ? { image } : {}),
    ...(store.contactEmail ? { email: store.contactEmail } : {}),
    ...(store.contactPhone ? { telephone: store.contactPhone } : {}),
    ...(hasAddress
      ? { address: { "@type": "PostalAddress", ...(store.business?.city ? { addressLocality: store.business.city } : {}), ...(store.business?.state ? { addressRegion: store.business.state } : {}), ...(country ? { addressCountry: country } : {}) } }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    // Only emit a rating when real reviews back it (Google penalises fabricated ratings).
    ...(typeof rating === "number" && rating > 0 && reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(rating.toFixed(1)), reviewCount, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  return (
    <>
      {!store.seoNoIndex && !store.marketingOnly && <JsonLd data={businessLd} />}
      {await renderStorefront(slug)}
    </>
  );
}
