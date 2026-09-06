import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStoreTheme } from "@/lib/template-themes";
import { UniversalSectionPage } from "@/components/storefront/universal-section-pages";

export async function renderUniversalSectionPage(slug: string, pageSlug: string) {
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      products: { where: { isPublished: true }, take: 30, include: { category: true } },
      services: { where: { isPublished: true }, take: 30, include: { category: true } },
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!store) notFound();

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const items = [
    ...store.products.map((x: any) => ({ id: x.id, kind: "product" as const, name: x.name, description: null, price: Number(x.price), currency: x.currency, image: x.images?.[0] ?? null, categoryName: x.category?.name ?? null, type: x.type, rentalUnit: x.rentalPeriodUnit ?? null, isBookable: false })),
    ...store.services.map((x: any) => ({ id: x.id, kind: "service" as const, name: x.name, description: x.description, price: Number(x.price), currency: x.currency, image: x.images?.[0] ?? null, categoryName: x.category?.name ?? null, type: "SERVICE", rentalUnit: null, isBookable: x.isBookable })),
  ];
  const social = (store.socialLinks as Record<string, string> | null) ?? {};
  return <UniversalSectionPage store={store} slug={slug} pageSlug={pageSlug} items={items} reviews={store.reviews} theme={theme} social={social} />;
}
