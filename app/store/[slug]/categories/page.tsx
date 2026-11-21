// Route: /store/[slug]/categories
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderBuilderSubpage } from "@/lib/storefront/builder-subpage";
import { usesRestaurantSkin } from "@/lib/store-pages";
import { RestaurantCategories } from "@/components/storefront/restaurant-menu";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true, products: { where: { isPublished: true }, take: 100, include: { category: true } }, services: { where: { isPublished: true }, take: 100, include: { category: true } } } });
  if (!store || store.status !== "ACTIVE") notFound();
  if (usesRestaurantSkin({ businessCategory: store.business?.category, businessSubcategory: store.business?.businessSubcategory, storeBusinessType: store.businessType, templateName: store.template?.name })) {
    const items = [
      ...store.products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, description: p.description ?? null, image: p.images[0] ?? null, categoryName: p.category?.name ?? null })),
      ...store.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, description: s.description ?? null, image: s.images[0] ?? null, categoryName: s.category?.name ?? null })),
    ];
    return <RestaurantCategories store={store} slug={slug} items={items} />;
  }
  const builder = await renderBuilderSubpage(slug, "categories");
  if (builder) return builder;
  notFound();
}
