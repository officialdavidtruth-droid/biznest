import { resolveStorePalette } from "@/lib/store-palette";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { usesGrandeurSkin } from "@/lib/store-pages";
import { resolveStoreTheme } from "@/lib/template-themes";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CartClient } from "./cart-client";
import { GrandeurCart } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { TasteHouseCart } from "@/components/storefront/tastehouse";
import { TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME } from "@/lib/template-themes";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { buildSystemSlots } from "@/components/storefront/system-slots";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };
  if (store.template?.name === EXAMPLE_TEMPLATE_NAME) return <ExampleStorefront store={store} slug={slug} items={[]} mode="cart" />;
  if (store.template?.name === TASTEHOUSE_TEMPLATE_NAME) return <TasteHouseCart store={store} slug={slug} />;
  if (usesGrandeurSkin({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name })) {
    const data = await getGrandeurRestaurantData(slug);
    if (data) return <GrandeurCart store={data.store} slug={slug} />;
  }
  const palette = resolveStorePalette(store);
  const slots = await buildSystemSlots(store, "cart", { text: palette.ink, accent: palette.accent, primary: palette.accent, line: `${palette.ink}22`, radius: 8, headingFont: palette.headlineFont });
  const cart = <CartClient slug={slug} storeName={store.name} logoUrl={store.logoUrl ?? null} palette={palette} topSlot={slots.top} bottomSlot={slots.bottom} externalChrome />;
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  return <StorefrontShell store={store} slug={slug} theme={theme}>{cart}</StorefrontShell>;
}
