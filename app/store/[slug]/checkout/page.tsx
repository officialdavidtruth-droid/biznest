import { resolveStorePalette } from "@/lib/store-palette";
import { TemplateShell } from "@/components/storefront/template-shell";
import { usesTemplateChromeFor } from "@/lib/storefront/template-chrome";
import { usesGrandeurSkin } from "@/lib/store-pages";
import { resolveStoreTheme } from "@/lib/template-themes";
import { isHotelStore } from "@/lib/storefront-routing"; import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { CheckoutClient } from "./checkout-client";
import { HotelCheckout } from "@/components/storefront/theluso-hotel";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";
import { getHotelContent } from "@/lib/hotel-content";
import { GrandeurCheckout } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { TrackBeginCheckout } from "@/components/storefront/store-tracking";

// One wrapper for every checkout skin (default, hotel, restaurant, TasteHouse,
// Example): the begin-checkout event fires once the buyer's cart is loaded,
// whichever template renders. redirect()/notFound() inside still propagate.
export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await renderCheckout(slug);
  return <><TrackBeginCheckout slug={slug} />{view}</>;
}

async function renderCheckout(slug: string) {
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  const isHotel = isHotelStore({ businessCategory: rawStore.business?.category, storeBusinessType: rawStore.businessType, templateName: rawStore.template?.name });
  if (isHotel) return <HotelCheckout store={rawStore} slug={slug} content={await getHotelContent(slug)} />;
  const session = await getStoreCustomerSessionForStore(slug);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/store/${slug}/checkout`)}&store=${encodeURIComponent(slug)}`);
  if (usesGrandeurSkin({ businessCategory: rawStore.business?.category, storeBusinessType: rawStore.businessType, templateName: rawStore.template?.name })) {
    const data = await getGrandeurRestaurantData(slug);
    if (data) return <GrandeurCheckout store={data.store} slug={slug} />;
  }
  const checkout = <CheckoutClient slug={slug} palette={resolveStorePalette(rawStore)} />;
  if (!usesTemplateChromeFor(rawStore.template?.name, rawStore.sectionOverrides, { businessCategory: rawStore.business?.category, storeBusinessType: rawStore.businessType })) return checkout;
  const theme = resolveStoreTheme(rawStore.template?.category, rawStore.name, rawStore.themeColors as any, rawStore.fontFamily, rawStore.template?.name);
  return <TemplateShell store={rawStore} slug={slug} theme={theme}>{checkout}</TemplateShell>;
}