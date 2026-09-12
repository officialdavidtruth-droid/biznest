import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { readBuilderConfig } from "@/lib/builder-config";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { GrandeurHome } from "@/components/storefront/grandeur-restaurant";
import { resolveStoreTheme, type TemplateTheme } from "@/lib/template-themes";

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
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
    ...store.products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, description: null, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name ?? null, type: p.type, rentalUnit: p.rentalPeriodUnit, isBookable: false })),
    ...store.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, description: s.description, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name ?? null, type: "SERVICE", rentalUnit: null, isBookable: s.isBookable })),
  ];

  if (String(store.business?.category || "").toLowerCase() === "restaurant") {
    return <GrandeurHome store={store} slug={slug} items={catalogItems} reviews={store.reviews} />;
  }

  const rawSectionOverrides = store.sectionOverrides as { builderVersion?: number; builder?: unknown } | null;
  const builderConfig = rawSectionOverrides?.builderVersion === 1 ? readBuilderConfig(rawSectionOverrides.builder) : null;
  if (builderConfig) {
    return <BuilderStorefront store={store} config={builderConfig} catalogItems={catalogItems} reviews={store.reviews} avgRating={null} completedOrders={0} />;
  }

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  return (
    <main style={{ minHeight: "100vh", background: theme.bg, color: theme.ink, fontFamily: theme.font }}>
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "12rem 2rem", textAlign: "center" }}>
        <p style={{ color: theme.accent, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Template rebuild in progress</p>
        <h1 style={{ fontFamily: theme.headlineFont, fontSize: "clamp(2rem,5vw,4rem)", margin: "1rem 0" }}>A new BizNest storefront is coming.</h1>
        <p style={{ opacity: .72 }}>This store uses a retired template. The old template code has been removed so the next template can be built independently without legacy template coupling.</p>
      </section>
    </main>
  );
}
