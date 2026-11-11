import { pageSkinFor } from "@/lib/storefront/page-skin-resolve";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CatalogExperience } from "@/components/storefront/catalog-experience";
import { TemplateShell } from "@/components/storefront/template-shell";
import { usesTemplateChromeFor } from "@/lib/storefront/template-chrome";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { resolveStoreTheme } from "@/lib/template-themes";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — Search results` : "Search" };
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  // Load the catalogue once; the page filters it live as the shopper types. `searchText` keeps description matches working.
  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id, isPublished: true, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 200, include: { category: true } }),
    prisma.service.findMany({ where: { storeId: store.id, isPublished: true }, take: 200, include: { category: true } }),
  ]);
  const items = [
    ...products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name ?? null, hasVariants: p.hasVariants, searchText: (p.description ?? "").slice(0, 400) })),
    ...services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name ?? null, searchText: (s.description ?? "").slice(0, 400) })),
  ];
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);

  const chrome = usesTemplateChromeFor(store.template?.name, store.sectionOverrides, { businessCategory: store.business?.category, storeBusinessType: store.businessType });
  const page = <CatalogExperience skin={pageSkinFor(store.template?.name)} mode="search" externalChrome={chrome} store={catalogStoreInfo(store, slug)} design={catalogDesign(store, theme)} items={items} initialQuery={query} />;
  return chrome ? <TemplateShell store={store} slug={slug} theme={theme}>{page}</TemplateShell> : page;
}
