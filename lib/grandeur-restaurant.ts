import { prisma } from "@/lib/prisma";

export async function getGrandeurRestaurantData(slug: string) {
  const rawStore = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      products: { where: { isPublished: true }, take: 60, include: { category: true } },
      services: { where: { isPublished: true }, take: 60, include: { category: true } },
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!rawStore || rawStore.status !== "ACTIVE") return null;

  const store = {
    id: rawStore.id,
    slug: rawStore.slug,
    name: rawStore.name,
    logoUrl: rawStore.logoUrl,
    bannerUrl: rawStore.bannerUrl,
    storyImage: rawStore.storyImage,
    storyOverrides: rawStore.storyOverrides,
    address: [rawStore.business?.city, rawStore.business?.state].filter(Boolean).join(", ") || null,
    phone: rawStore.contactPhone ?? rawStore.business?.phone ?? null,
    email: rawStore.contactEmail ?? rawStore.business?.email ?? null,
    business: rawStore.business
      ? { category: rawStore.business.category, description: rawStore.business.description, sellsProducts: rawStore.business.sellsProducts }
      : null,
  };

  const items = [
    ...rawStore.products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, description: null as string | null, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name ?? null, isBookable: false })),
    ...rawStore.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, description: s.description, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name ?? null, isBookable: s.isBookable })),
  ];
  return { store, items, reviews: rawStore.reviews };
}

export function isRestaurantBusiness(store: any) {
  return String(store?.business?.category || "").toLowerCase() === "restaurant";
}