import { isHotelStore } from "@/lib/storefront-routing"; import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { CheckoutClient } from "./checkout-client";
import { HotelCheckout } from "@/components/storefront/theluso-hotel";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";
import { getHotelContent } from "@/lib/hotel-content";
import { GrandeurCheckout } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { TasteHouseCheckout } from "@/components/storefront/tastehouse";
import { TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME } from "@/lib/template-themes";
import { ExampleStorefront } from "@/components/storefront/example-store";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  const isHotel = isHotelStore({ businessCategory: rawStore.business?.category, storeBusinessType: rawStore.businessType, templateName: rawStore.template?.name });
  if (isHotel) return <HotelCheckout store={rawStore} slug={slug} content={await getHotelContent(slug)} />;
  const session = await getStoreCustomerSessionForStore(slug);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/store/${slug}/checkout`)}&store=${encodeURIComponent(slug)}`);
  if (rawStore.template?.name === EXAMPLE_TEMPLATE_NAME) { return <ExampleStorefront store={{...rawStore,sellsProducts:rawStore.business?.sellsProducts??true}} slug={slug} items={[]} mode="checkout"/>; }
  if (rawStore.template?.name === TASTEHOUSE_TEMPLATE_NAME) {
    return <TasteHouseCheckout store={{...rawStore,sellsProducts:rawStore.business?.sellsProducts??true}} slug={slug}/>;
  }
  if (String(rawStore.business?.category || "").toLowerCase() === "restaurant") {
    const data = await getGrandeurRestaurantData(slug);
    if (data) return <GrandeurCheckout store={data.store} slug={slug} />;
  }
  return <CheckoutClient slug={slug} />;
}