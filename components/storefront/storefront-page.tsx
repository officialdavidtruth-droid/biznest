import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { readBuilderConfig, defaultBuilderConfig } from "@/lib/builder-config";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { GrandeurHome } from "@/components/storefront/grandeur-restaurant";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { TasteHouseHome } from "@/components/storefront/tastehouse";
import { TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME } from "@/lib/template-themes";
import { getTasteHouseContent } from "@/lib/tastehouse-content";
import { getExampleContent } from "@/lib/example-content";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { getHotelContent } from "@/lib/hotel-content";
import { resolveStoreTheme, type TemplateTheme } from "@/lib/template-themes";

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean; hasVariants?: boolean;
};

const getStoreForSlug = cache((slug: string) => prisma.store.findUnique({
  where: { slug },
  include: {
    template: true,
    business: true,
    products: { where: { isPublished: true }, take: 24, include: { category: true } },
    services: { where: { isPublished: true }, take: 24, include: { category: true } },
    reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 6 },
  },
}));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreForSlug(slug);
  if (!store) return {};
  return { title: store.seoTitle ?? store.name, description: store.seoDescription ?? undefined };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawStore = await getStoreForSlug(slug);
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();

  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };
  void recordStoreVisit(store.id, `/${slug}`);

  const catalogItems: CatalogItem[] = [
    ...store.products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, description: null, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name ?? null, type: p.type, rentalUnit: p.rentalPeriodUnit, isBookable: false, hasVariants: p.hasVariants })),
    ...store.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, description: s.description, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name ?? null, type: "SERVICE", rentalUnit: null, isBookable: s.isBookable })),
  ];

  if (store.template?.name === TASTEHOUSE_TEMPLATE_NAME) {
    return <TasteHouseHome store={store} slug={slug} items={catalogItems} content={await getTasteHouseContent(slug)} />;
  }
  if (store.template?.name === EXAMPLE_TEMPLATE_NAME) {
    return <ExampleStorefront store={store} slug={slug} items={catalogItems} mode="home" content={await getExampleContent(slug) as any} />;
  }
  if (String(store.business?.category || "").toLowerCase() === "restaurant") {
    return <GrandeurHome store={store} slug={slug} items={catalogItems} reviews={store.reviews} />;
  }
  if (String(store.business?.category || "").toLowerCase().includes("hotel") || String(store.template?.name || "").includes("THELUSO")) {
    const hotelContent = await getHotelContent(slug);
    return <ThelusoHotel store={store} slug={slug} content={hotelContent} />;
  }

  const rawSectionOverrides = store.sectionOverrides as { builderVersion?: number; builder?: unknown } | null;
  const builderConfig = rawSectionOverrides?.builderVersion === 1 ? readBuilderConfig(rawSectionOverrides.builder) : null;
  if (builderConfig) {
    return <BuilderStorefront store={store} config={builderConfig} catalogItems={catalogItems} reviews={store.reviews} avgRating={null} completedOrders={0} />;
  }

  const fallbackConfig = defaultBuilderConfig(store.name, store.business?.description, store.bannerUrl, store.business?.category, { sellsProducts: store.business?.sellsProducts, offersServices: store.business?.offersServices });
  return <BuilderStorefront store={store} config={fallbackConfig} catalogItems={catalogItems} reviews={store.reviews} avgRating={null} completedOrders={0} />;
}