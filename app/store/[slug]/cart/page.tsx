import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CartClient } from "./cart-client";
import { GrandeurCart } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { TasteHouseCart } from "@/components/storefront/tastehouse";
import { TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME } from "@/lib/template-themes";
import { ExampleStorefront } from "@/components/storefront/example-store";

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
  return <CartClient slug={slug} />;
}
