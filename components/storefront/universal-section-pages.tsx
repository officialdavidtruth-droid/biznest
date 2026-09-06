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
      products: { where: { isPublished: true }, take: 24, include: { category: true } },
      services: { where: { isPublished: true }, take: 24, include: { category: true } },
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 6 },
    },
  })
);

export async function renderUniversalSectionPage(slug: string, pageSlug: string) {
  const rawStore = await getStoreForSection(slug);
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();

  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };

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
    />
  );
}
