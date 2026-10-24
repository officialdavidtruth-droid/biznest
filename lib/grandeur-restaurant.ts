import { prisma } from "@/lib/prisma";
import { isGrandeurStore } from "@/lib/store-pages";

export async function getGrandeurRestaurantData(slug: string) {
  // Grandeur is the restaurant skin only. This helper used to return data for ANY
  // active store, so /about, /contact, /events, /gallery, /reservations, /payment
  // and order confirmation rendered the restaurant template on electronics,
  // fashion, services stores, etc. Gate with a cheap query first; return null
  // unless this really is a Grandeur/restaurant store so callers fall through
  // to their own fallback.
  const gate = await prisma.store.findUnique({
    where: { slug },
    select: { status: true, businessType: true, business: { select: { category: true } }, template: { select: { name: true } } },
  });
  if (!gate || gate.status !== "ACTIVE") return null;
  const isGrandeur = isGrandeurStore({ businessCategory: gate.business?.category ?? null, storeBusinessType: gate.businessType, templateName: gate.template?.name });
  if (!isGrandeur) return null;

  const rawStore = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      products: { where: { isPublished: true }, take: 60, include: { category: true, variants: { where: { isActive: true }, select: { id: true } } } },
      services: { where: { isPublished: true }, take: 60, include: { category: true } },
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!rawStore) return null;

  const store = {
    id: rawStore.id,
    slug: rawStore.slug,
    name: rawStore.name,
    logoUrl: rawStore.logoUrl,
    bannerUrl: rawStore.bannerUrl,
    storyImage: rawStore.storyImage,
    storyOverrides: rawStore.storyOverrides,
    address: rawStore.business ? [rawStore.business.city, rawStore.business.state].filter(Boolean).join(", ") || null : null,
    phone: rawStore.contactPhone || rawStore.business?.phone || null,
    email: rawStore.contactEmail || rawStore.business?.email || null,
    business: rawStore.business
      ? { category: rawStore.business.category, description: rawStore.business.description, sellsProducts: rawStore.business.sellsProducts }
      : null,
  };

  const items = [
    ...rawStore.products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, description: null as string | null, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name ?? null, isBookable: false, hasVariants: p.hasVariants })),
    ...rawStore.services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, description: s.description, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name ?? null, isBookable: s.isBookable })),
  ];
  return { store, items, reviews: rawStore.reviews };
}

export function isRestaurantBusiness(store: any) {
  return String(store?.business?.category || "").toLowerCase() === "restaurant";
}