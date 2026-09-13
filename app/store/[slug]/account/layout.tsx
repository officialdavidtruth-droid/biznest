import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { getUnreadStoreMessageCount } from "@/lib/actions/account";
import { redirect, notFound } from "next/navigation";
import { StoreAccountLegacyShell } from "@/components/storefront/store-account-legacy-shell";
import { ExampleAccountShell } from "@/components/storefront/example-account-shell";
import { VelouraAccountShell } from "@/components/storefront/veloura-account-shell";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";
import { EXAMPLE_TEMPLATE_NAME } from "@/lib/example-content";
import { prisma } from "@/lib/prisma";

export default async function StoreAccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const membership = await requireStoreCustomer(slug);
  if (!membership) redirect(`/login?store=${encodeURIComponent(slug)}&callbackUrl=/store/${encodeURIComponent(slug)}/account`);
  const store = await getStoreBranding(slug);
  if (!store) notFound();
  const unreadMessageCount = await getUnreadStoreMessageCount(slug);
  const template = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  if (template?.template?.name === EXAMPLE_TEMPLATE_NAME) return <ExampleAccountShell slug={slug} store={store} membership={membership}>{children}</ExampleAccountShell>;
  if (template?.template?.name === HOTEL_TEMPLATE_NAME) return <VelouraAccountShell slug={slug} store={store} membership={membership} unreadMessageCount={unreadMessageCount}>{children}</VelouraAccountShell>;
  const nav = { sellsProducts: store.sellsProducts, offersServices: store.offersServices };
  return <StoreAccountLegacyShell slug={slug} store={store} membership={membership} unreadMessageCount={unreadMessageCount} nav={nav}>{children}</StoreAccountLegacyShell>;
}
