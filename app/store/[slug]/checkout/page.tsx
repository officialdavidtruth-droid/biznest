import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { CheckoutClient } from "./checkout-client";
import { GrandeurCheckout } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  const session = await getStoreCustomerSessionForStore(slug);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/store/${slug}/checkout`)}&store=${encodeURIComponent(slug)}`);
  if (String(rawStore.business?.category || "").toLowerCase() === "restaurant") {
    const data = await getGrandeurRestaurantData(slug);
    if (data) return <GrandeurCheckout store={data.store} slug={slug} />;
  }
  return <CheckoutClient slug={slug} />;
}
