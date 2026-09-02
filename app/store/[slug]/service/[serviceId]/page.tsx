import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveStoreTheme, type TemplateTheme } from "@/lib/template-themes";
import { isSignatureTemplate, getSignatureTheme } from "@/lib/template-themes";
import { SignatureJourney } from "@/components/storefront/signature-journey";
import { SignatureServiceDetail } from "@/components/storefront/signature-service-detail";
import { CatalogItemDetail } from "@/components/storefront/catalog-item-detail";
import { PhotographyBookingClient } from "@/components/storefront/photography-booking-client";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; serviceId: string }> }): Promise<Metadata> {
  const { slug, serviceId } = await params;
  const service = await prisma.service.findFirst({ where: { id: serviceId, store: { slug } } });
  if (!service) return {};
  return { title: `${service.name} — ${slug}`, description: service.description?.slice(0, 150) };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string; serviceId: string }> }) {
  const { slug, serviceId } = await params;

  const rawStore = await prisma.store.findUnique({
    where: { slug },
    include: { template: true, business: true },
  });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  // Flatten Business.sellsProducts onto the store object once, since the
  // chrome/home components read `store.sellsProducts` directly.
  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };

  const service = await prisma.service.findFirst({
    where: { id: serviceId, storeId: store.id, isPublished: true },
    include: { category: true, reviews: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!service) notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  // This template's own real palette/radius, not a Heenzy-only fallback.
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const signatureTheme = isSignatureTemplate(store.template?.name) ? getSignatureTheme(store.template?.name) : null;
  const businessCategory = store.businessType ?? store.business?.category ?? null;

  const isPhotographyBusiness = store.businessType === "Photography" || /photography|photographer/i.test(`${store.business?.businessSubcategory ?? ""} ${store.template?.name ?? ""}`);

  // Photography templates use the dedicated Vere Studio-style booking journey.
  // This branch is intentionally scoped to photography businesses only.
  if (isPhotographyBusiness) {
    return <PhotographyBookingClient store={store} slug={slug} service={service} theme={theme} />;
  }

  if (isSignatureTemplate(store.template?.name)) {
    const t = getSignatureTheme(store.template?.name);
    return <SignatureJourney store={store} slug={slug} templateName={store.template?.name ?? ""} title={service.name}>
      <SignatureServiceDetail store={store} slug={slug} service={service} accent={t.accent} ink={t.ink} bg={t.bg} radius={t.radius} card={t.card} headlineFont={t.headlineFont} />
    </SignatureJourney>;
  }

  // Every other niche (hotel rooms, salon appointments, consultations,
  // rentals, ...) shares the same rich item-detail layout -- gallery,
  // booking summary, amenities/specs pulled from Service.attributes, and
  // the shared BookingWidget. See catalog-item-detail.tsx.
  const itemTheme = signatureTheme || theme;
  return <CatalogItemDetail store={store} slug={slug} service={service} theme={itemTheme} businessCategory={businessCategory} hotelMode={signatureTheme?.signatureMode} />;
}
