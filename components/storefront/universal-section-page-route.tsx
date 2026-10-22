import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme, type TemplateTheme } from "@/lib/template-themes";
import { UniversalSectionPage } from "@/components/storefront/universal-section-pages";

// Shared by /about, /services, /portfolio, /pricing and /contact — each of
// those route files just calls this with its own pageSlug. Mirrors the
// data-fetching shape of the main storefront page.tsx, but only pulls the
// fields UniversalSectionPage actually needs.
const getStoreForSection = cache((slug: string) =>
  prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      products: { where: { isPublished: true }, orderBy: { createdAt: "desc" }, take: 24, include: { category: true } },
      services: { where: { isPublished: true }, orderBy: { createdAt: "desc" }, take: 24, include: { category: true } },
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 6 },
    },
  })
);

export const SERVICES_PAGE_SIZE = 12;

export async function renderUniversalSectionPage(slug: string, pageSlug: string, opts?: { page?: number }) {
  const rawStore = await getStoreForSection(slug);
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();

  // /services is paginated: the 24-row include above is only a cheap preview
  // for the other section pages, so /services fetches its own page of rows
  // (newest first, stable order) plus a total count for the pager.
  let pagination: { page: number; totalPages: number; total: number; pageSize: number } | undefined;
  let services = rawStore.services;
  if (pageSlug === "services") {
    const where = { storeId: rawStore.id, isPublished: true };
    const total = await prisma.service.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / SERVICES_PAGE_SIZE));
    const page = Math.min(Math.max(1, Math.floor(opts?.page ?? 1) || 1), totalPages);
    services = await prisma.service.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * SERVICES_PAGE_SIZE,
      take: SERVICES_PAGE_SIZE,
      include: { category: true },
    });
    pagination = { page, totalPages, total, pageSize: SERVICES_PAGE_SIZE };
  }

  const store = { ...rawStore, services, sellsProducts: rawStore.business?.sellsProducts ?? true };

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const social = (store.socialLinks as Record<string, string> | null) ?? {};

  const items = [
    ...store.products.map((p) => ({
      id: p.id,
      kind: "product" as const,
      name: p.name,
      description: null as string | null,
      price: Number(p.price),
      currency: p.currency,
      image: p.images[0] ?? null,
      categoryName: p.category?.name ?? null,
      type: p.type,
      rentalUnit: p.rentalPeriodUnit,
      isBookable: false,
      durationMins: null as number | null,
    })),
    ...store.services.map((s) => ({
      id: s.id,
      kind: "service" as const,
      name: s.name,
      description: s.description,
      price: Number(s.price),
      currency: s.currency,
      image: s.images[0] ?? null,
      categoryName: s.category?.name ?? null,
      type: "SERVICE",
      rentalUnit: null,
      isBookable: s.isBookable,
      durationMins: s.durationMins ?? null,
    })),
  ];

  return (
    <UniversalSectionPage
      store={store}
      slug={slug}
      pageSlug={pageSlug}
      items={items}
      reviews={store.reviews}
      theme={theme}
      social={social}
      pagination={pagination}
    />
  );
}