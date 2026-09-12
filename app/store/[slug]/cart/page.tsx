import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CartClient } from "./cart-client";
import { GrandeurCart } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };
  if (String(store.business?.category || "").toLowerCase() === "restaurant") {
    const data = await getGrandeurRestaurantData(slug);
    if (data) return <GrandeurCart store={data.store} slug={slug} />;
  }
  return <CartClient slug={slug} />;
}
