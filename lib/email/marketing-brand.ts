import type { Business, Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MarketingBrand, MarketingItem } from "@/lib/email/marketing-templates";

/** The store's logo, colours, font and contact details, in the shape the email designs expect. */
export function buildMarketingBrand(store: Store & { business: Business }): MarketingBrand {
  const colors = (store.themeColors as Record<string, string> | null) ?? {};
  return {
    name: store.name,
    storeId: store.id,
    slug: store.slug,
    logoUrl: store.logoUrl,
    bannerUrl: store.bannerUrl,
    primary: colors.primary ?? colors.accent ?? "#111827",
    secondary: colors.secondary ?? "#111827",
    accent: colors.accent ?? colors.primary ?? "#2563eb",
    background: colors.background ?? "#f3f4f6",
    text: colors.text ?? "#111827",
    fontFamily: store.fontFamily ?? "Arial",
    contactEmail: store.contactEmail ?? store.business.email,
    contactPhone: store.contactPhone ?? store.business.phone,
    socialLinks: (store.socialLinks as Record<string, string> | null) ?? null,
    businessType: store.businessType,
    businessDescription: store.business.description,
    sellsProducts: store.business.sellsProducts,
    offersServices: store.business.offersServices,
  };
}

/** Published products and services that can be featured in a campaign. */
export async function loadMarketingItems(storeId: string, slug: string): Promise<MarketingItem[]> {
  const select = { id: true, name: true, description: true, price: true, currency: true, images: true } as const;
  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { storeId, isPublished: true }, select, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.service.findMany({ where: { storeId, isPublished: true }, select, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return [
    ...products.map((p) => ({ kind: "product" as const, name: p.name, description: p.description, price: `${p.currency} ${Number(p.price).toLocaleString()}`, imageUrl: p.images[0] ?? null, href: `/store/${slug}/product/${p.id}` })),
    ...services.map((s) => ({ kind: "service" as const, name: s.name, description: s.description, price: `${s.currency} ${Number(s.price).toLocaleString()}`, imageUrl: s.images[0] ?? null, href: `/store/${slug}/service/${s.id}` })),
  ].slice(0, 12);
}
