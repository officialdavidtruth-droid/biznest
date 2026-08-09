import { prisma } from "@/lib/prisma";
import { isHeenzyTemplate, isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, isPremiumTemplate, isHomeVistaTemplate, VIOLET, MARKETPLACE, ARCOVA, NOVA, PREMIUM, HOMEVISTA } from "@/lib/template-themes";
import { CartClient } from "./cart-client";
import { HeenzyCartClient } from "./heenzy-cart-client";
import { VioletCartClient } from "./violet-cart-client";
import { MarketplaceCartClient } from "./marketplace-cart-client";
import { ArcovaCartClient } from "./arcova-cart-client";
import { NovaCartClient } from "./nova-cart-client";
import { PremiumCartClient } from "./premium-cart-client";
import { HomeVistaCartClient } from "./homevista-cart-client";
import { VioletHeader, VioletFooter } from "@/components/storefront/templates/violet-chrome";
import { MarketplaceHeader, MarketplaceFooter } from "@/components/storefront/templates/marketplace-chrome";
import { ArcovaHeader, ArcovaFooter } from "@/components/storefront/templates/arcova-chrome";
import { NovaHeader, NovaFooter } from "@/components/storefront/templates/nova-chrome";
import { PremiumHeader, PremiumFooter } from "@/components/storefront/templates/premium-chrome";
import { HomeVistaHeader, HomeVistaFooter } from "@/components/storefront/templates/homevista-chrome";
import { getStoreCategoryTree } from "@/lib/storefront-categories";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  const heenzy = isHeenzyTemplate(store?.template?.name);
  const violet = store && isVioletTemplate(store.template?.name);
  const marketplace = store && isMarketplaceTemplate(store.template?.name);
  const arcova = store && isArcovaTemplate(store.template?.name);
  const nova = store && isNovaTemplate(store.template?.name);
  const premium = store && isPremiumTemplate(store.template?.name);
  const homevista = store && isHomeVistaTemplate(store.template?.name);

  if (violet && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: VIOLET.bg, color: VIOLET.ink, fontFamily: VIOLET.font, minHeight: "100vh" }}>
        <VioletHeader store={store} slug={slug} navCategories={navCategories} />
        <VioletCartClient slug={slug} />
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
        <MarketplaceCartClient slug={slug} />
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
        <ArcovaCartClient slug={slug} />
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
        <NovaCartClient slug={slug} />
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
        <PremiumCartClient slug={slug} />
        <PremiumFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (homevista && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: HOMEVISTA.ink, fontFamily: HOMEVISTA.font, fontSize: 13, minHeight: "100vh" }}>
        <HomeVistaHeader store={store} slug={slug} navCategories={navCategories} />
        <HomeVistaCartClient slug={slug} />
        <HomeVistaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return heenzy ? <HeenzyCartClient slug={slug} /> : <CartClient slug={slug} />;
}
