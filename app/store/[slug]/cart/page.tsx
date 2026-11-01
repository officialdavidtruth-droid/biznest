import { resolveStorePalette } from "@/lib/store-palette";
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
  if (String(store.business?.category || "").toLowerCase() === "restaurant") {
    const data = await getGrandeurRestaurantData(slug);
    if (data) return <GrandeurCart store={data.store} slug={slug} />;
  }
  const palette = resolveStorePalette(store);
  const slots = await buildSystemSlots(store, "cart", { text: palette.ink, accent: palette.accent, primary: palette.accent, line: `${palette.ink}22`, radius: 8, headingFont: palette.headlineFont });
  return <CartClient slug={slug} storeName={store.name} logoUrl={store.logoUrl ?? null} palette={palette} topSlot={slots.top} bottomSlot={slots.bottom} />;
}
