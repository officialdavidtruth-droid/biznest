import type { Business, Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MarketingBrand, MarketingItem } from "@/lib/email/marketing-templates";

/** The subset of a MarketingWebsiteConnection needed to brand an email. Pass the row however it was fetched (full model or a select). */
export type MarketingWebsiteBrand = {
  status: string;
  businessName?: string | null;
  businessType?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socialLinks?: unknown;
} | null;

/**
 * The store's logo, colours, font and contact details, in the shape the email
 * designs expect. When a website connection is passed and verified, its
 * live-scanned brand (logo, colours, description, contact info) is preferred
 * over the store's own onboarding defaults -- this is what lets a
 * marketing-only account's campaigns actually reflect their real website
 * instead of generic/placeholder account content. Any field the site didn't
 * turn up falls back to the store's own setting.
 */
export function buildMarketingBrand(store: Store & { business: Business }, connection?: MarketingWebsiteBrand): MarketingBrand {
  const colors = (store.themeColors as Record<string, string> | null) ?? {};
  const site = connection?.status === "CONNECTED" ? connection : null;
  const siteSocial = (site?.socialLinks as Record<string, string> | null) ?? null;
  const storeSocial = (store.socialLinks as Record<string, string> | null) ?? null;
  return {
    name: site?.businessName || store.name,
    storeId: store.id,
    slug: store.slug,
    logoUrl: site?.logoUrl || store.logoUrl,
    bannerUrl: store.bannerUrl,
    primary: site?.primaryColor || colors.primary || colors.accent || "#111827",
    secondary: site?.secondaryColor || colors.secondary || "#111827",
    accent: site?.primaryColor || colors.accent || colors.primary || "#2563eb",
    background: colors.background ?? "#f3f4f6",
    text: colors.text ?? "#111827",
    fontFamily: store.fontFamily ?? "Arial",
    contactEmail: site?.contactEmail || store.contactEmail || store.business.email,
    contactPhone: site?.contactPhone || store.contactPhone || store.business.phone,
    socialLinks: (siteSocial && Object.keys(siteSocial).length ? siteSocial : storeSocial) ?? null,
    businessType: site?.businessType || store.businessType,
    businessDescription: site?.description || store.business.description,
    sellsProducts: store.business.sellsProducts,
    offersServices: store.business.offersServices,
  };
}

/**
 * Published products and services that can be featured in a campaign. A
 * marketing-only account has no BizNest storefront, so its `Product`/`Service`
 * tables are always empty -- for those, fall back to whatever the connected
 * website's catalog scan found, so campaigns have real items to feature
 * instead of an empty list.
 */
export async function loadMarketingItems(storeId: string, slug: string): Promise<MarketingItem[]> {
  const select = { id: true, name: true, description: true, price: true, currency: true, images: true } as const;
  const [products, services, catalog] = await Promise.all([
    prisma.product.findMany({ where: { storeId, isPublished: true }, select, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.service.findMany({ where: { storeId, isPublished: true }, select, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.marketingCatalogItem.findMany({ where: { storeId, isActive: true }, orderBy: { updatedAt: "desc" }, take: 12 }),
  ]);
  const own = [
    ...products.map((p) => ({ kind: "product" as const, name: p.name, description: p.description, price: `${p.currency} ${Number(p.price).toLocaleString()}`, imageUrl: p.images[0] ?? null, href: `/store/${slug}/product/${p.id}` })),
    ...services.map((s) => ({ kind: "service" as const, name: s.name, description: s.description, price: `${s.currency} ${Number(s.price).toLocaleString()}`, imageUrl: s.images[0] ?? null, href: `/store/${slug}/service/${s.id}` })),
  ];
  if (own.length) return own.slice(0, 12);
  return catalog
    .map((c) => ({
      kind: (c.type === "SERVICE" ? "service" : "product") as "product" | "service",
      name: c.name,
      description: c.description,
      price: c.salePrice ?? (c.price ? (c.currency ? `${c.currency} ${c.price}` : c.price) : undefined),
      imageUrl: c.imageUrl,
      href: c.url ?? undefined,
    }))
    .slice(0, 12);
}