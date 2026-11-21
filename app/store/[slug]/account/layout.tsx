import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { getUnreadStoreMessageCount } from "@/lib/actions/account";
import { redirect, notFound } from "next/navigation";
import { StoreAccountLegacyShell } from "@/components/storefront/store-account-legacy-shell";
import { VelouraAccountShell } from "@/components/storefront/veloura-account-shell";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";
import { prisma } from "@/lib/prisma";
import { usesRestaurantSkin } from "@/lib/store-pages";
import { RestaurantAccountFrame } from "@/components/storefront/restaurant-account-frame";

export default async function StoreAccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = await requireStoreCustomer(slug);
  if (!membership) redirect(`/login?store=${encodeURIComponent(slug)}&callbackUrl=/store/${encodeURIComponent(slug)}/account`);
  const store = await getStoreBranding(slug);
  if (!store) notFound();
  const unreadMessageCount = await getUnreadStoreMessageCount(slug);
  const template = await prisma.store.findUnique({ where: { slug }, select: { businessType: true, template: { select: { name: true } }, business: { select: { category: true, businessSubcategory: true } } } });
  if (template?.template?.name === HOTEL_TEMPLATE_NAME) return <VelouraAccountShell slug={slug} store={store} membership={membership}>{children}</VelouraAccountShell>;
  const nav = { sellsProducts: store.sellsProducts, offersServices: store.offersServices };
  const legacy = <StoreAccountLegacyShell slug={slug} store={store} membership={membership} unreadMessageCount={unreadMessageCount} nav={nav}>{children}</StoreAccountLegacyShell>;
  // Restaurant stores show the orders page inside the shared restaurant frame (it brings its own header and footer).
  if (usesRestaurantSkin({ businessCategory: template?.business?.category ?? null, businessSubcategory: template?.business?.businessSubcategory ?? null, storeBusinessType: template?.businessType, templateName: template?.template?.name ?? null } as any)) {
    return <RestaurantAccountFrame legacy={legacy}>{children}</RestaurantAccountFrame>;
  }
  return legacy;
}
