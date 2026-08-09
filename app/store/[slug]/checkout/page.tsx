import { prisma } from "@/lib/prisma";
import { isHeenzyTemplate, isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, isPremiumTemplate, VIOLET, MARKETPLACE, ARCOVA, NOVA, PREMIUM } from "@/lib/template-themes";
import { CheckoutClient } from "./checkout-client";
import { HeenzyCheckoutClient } from "./heenzy-checkout-client";
import { VioletCheckoutClient } from "./violet-checkout-client";
import { MarketplaceCheckoutClient } from "./marketplace-checkout-client";
import { ArcovaCheckoutClient } from "./arcova-checkout-client";
import { NovaCheckoutClient } from "./nova-checkout-client";
import { PremiumCheckoutClient } from "./premium-checkout-client";
import { VioletHeader, VioletFooter } from "@/components/storefront/templates/violet-chrome";
import { MarketplaceHeader, MarketplaceFooter } from "@/components/storefront/templates/marketplace-chrome";
import { ArcovaHeader, ArcovaFooter } from "@/components/storefront/templates/arcova-chrome";
import { NovaHeader, NovaFooter } from "@/components/storefront/templates/nova-chrome";
import { PremiumHeader, PremiumFooter } from "@/components/storefront/templates/premium-chrome";
import { getStoreCategoryTree } from "@/lib/storefront-categories";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  const heenzy = isHeenzyTemplate(store?.template?.name);
  const violet = store && isVioletTemplate(store.template?.name);
  const marketplace = store && isMarketplaceTemplate(store.template?.name);
  const arcova = store && isArcovaTemplate(store.template?.name);
  const nova = store && isNovaTemplate(store.template?.name);
  const premium = store && isPremiumTemplate(store.template?.name);

  if (violet && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: VIOLET.bg, color: VIOLET.ink, fontFamily: VIOLET.font, minHeight: "100vh" }}>
        <VioletHeader store={store} slug={slug} navCategories={navCategories} />
        <VioletCheckoutClient slug={slug} />
        <VioletFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (marketplace && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: MARKETPLACE.ink, fontFamily: MARKETPLACE.font, fontSize: 12, minHeight: "100vh" }}>
        <MarketplaceHeader store={store} slug={slug} navCategories={navCategories} />
        <MarketplaceCheckoutClient slug={slug} />
        <MarketplaceFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (arcova && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: ARCOVA.paper, color: ARCOVA.ink, fontFamily: ARCOVA.font, minHeight: "100vh" }}>
        <ArcovaHeader store={store} slug={slug} navCategories={navCategories} />
        <ArcovaCheckoutClient slug={slug} />
        <ArcovaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (nova && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: NOVA.black, color: NOVA.cream, fontFamily: NOVA.font, minHeight: "100vh" }}>
        <NovaHeader store={store} slug={slug} navCategories={navCategories} />
        <NovaCheckoutClient slug={slug} />
        <NovaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (premium && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: PREMIUM.bg, color: PREMIUM.ink, fontFamily: PREMIUM.font, fontSize: 13, minHeight: "100vh" }}>
        <PremiumHeader store={store} slug={slug} navCategories={navCategories} />
        <PremiumCheckoutClient slug={slug} />
        <PremiumFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return heenzy ? <HeenzyCheckoutClient slug={slug} /> : <CheckoutClient slug={slug} />;
}
