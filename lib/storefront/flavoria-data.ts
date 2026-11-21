import { prisma } from "@/lib/prisma";
import { usesFlavoriaHome } from "@/lib/store-pages";
import type { RestaurantItem } from "@/components/storefront/restaurant-home";

/** The store and its dishes for the Flavoria-look pages, or null when the store is not on that template. */
export async function getFlavoriaData(slug: string): Promise<{ store: any; items: RestaurantItem[] } | null> {
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { template: true, business: true, products: { where: { isPublished: true }, take: 200, include: { category: true } }, services: { where: { isPublished: true }, take: 100, include: { category: true } } },
  });
  if (!store || store.status !== "ACTIVE") return null;
  if (!usesFlavoriaHome({ businessCategory: store.business?.category, businessSubcategory: store.business?.businessSubcategory, storeBusinessType: store.businessType, templateName: store.template?.name } as any)) return null;
  const items: RestaurantItem[] = [
    ...store.products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, description: p.description ?? null, image: p.images[0] ?? null, categoryName: p.category?.name ?? null, hasVariants: p.hasVariants })),
    ...store.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, description: s.description ?? null, image: s.images[0] ?? null, categoryName: s.category?.name ?? null })),
  ];
  return { store, items };
}
