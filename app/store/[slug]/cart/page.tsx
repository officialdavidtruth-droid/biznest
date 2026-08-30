import { prisma } from "@/lib/prisma";
import { isHeenzyTemplate, isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, isPremiumTemplate, isHomeVistaTemplate, isRrwTemplate, isRivoraTemplate, isFabtexTemplate, isJuiceLifeTemplate, VIOLET, MARKETPLACE, ARCOVA, NOVA, PREMIUM, HOMEVISTA, RRW, FABTEX } from "@/lib/template-themes";
import { CartClient } from "./cart-client";
import { HeenzyCartClient } from "./heenzy-cart-client";
import { VioletCartClient } from "./violet-cart-client";
import { MarketplaceCartClient } from "./marketplace-cart-client";
import { ArcovaCartClient } from "./arcova-cart-client";
import { NovaCartClient } from "./nova-cart-client";
import { PremiumCartClient } from "./premium-cart-client";
import { HomeVistaCartClient } from "./homevista-cart-client";
import { RrwCartClient } from "./rrw-cart-client";
import { RivoraCartClient } from "./rivora-cart-client";
import { FabtexCartClient } from "./fabtex-cart-client";
import { JuiceLifeCartClient } from "./juicelife-cart-client";
import { VioletHeader, VioletFooter } from "@/components/storefront/templates/violet-chrome";
import { MarketplaceHeader, MarketplaceFooter } from "@/components/storefront/templates/marketplace-chrome";
import { ArcovaHeader, ArcovaFooter } from "@/components/storefront/templates/arcova-chrome";
import { NovaHeader, NovaFooter } from "@/components/storefront/templates/nova-chrome";
import { PremiumHeader, PremiumFooter } from "@/components/storefront/templates/premium-chrome";
import { HomeVistaHeader, HomeVistaFooter } from "@/components/storefront/templates/homevista-chrome";
import { RrwHeader, RrwFooter } from "@/components/storefront/templates/rrw-chrome";
import { HeenzyHeader, HeenzyFooter } from "@/components/storefront/templates/heenzy-chrome";
import { RivoraHeader, RivoraFooter } from "@/components/storefront/templates/rivora-chrome";
import { FabtexHeader, FabtexFooter } from "@/components/storefront/templates/fabtex-chrome";
import { JuiceLifeHeader, JuiceLifeFooter } from "@/components/storefront/templates/juicelife-chrome";
import { getStoreCategoryTree } from "@/lib/storefront-categories";
import { isSignatureTemplate } from "@/lib/template-themes";
import { SignatureCartClient } from "@/components/storefront/signature-cart-client";
import { SignatureJourney } from "@/components/storefront/signature-journey";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  const heenzy = isHeenzyTemplate(store?.template?.name);
  const rivora = store && isRivoraTemplate(store.template?.name);
  const fabtex = store && isFabtexTemplate(store.template?.name);
  const juicelife = store && isJuiceLifeTemplate(store.template?.name);
  const violet = store && isVioletTemplate(store.template?.name);
  const marketplace = store && isMarketplaceTemplate(store.template?.name);
  const arcova = store && isArcovaTemplate(store.template?.name);
  const nova = store && isNovaTemplate(store.template?.name);
  const premium = store && isPremiumTemplate(store.template?.name);
  const homevista = store && isHomeVistaTemplate(store.template?.name);
  const rrw = store && isRrwTemplate(store.template?.name);

  if (store && isSignatureTemplate(store.template?.name)) {
    return (
      <SignatureJourney store={store} slug={slug} templateName={store.template?.name ?? ""} title="Your selection">
        <SignatureCartClient slug={slug} templateName={store.template?.name ?? ""} />
      </SignatureJourney>
    );
  }

  if (violet && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: VIOLET.bg, color: VIOLET.ink, fontFamily: VIOLET.font, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: "#fff", color: MARKETPLACE.ink, fontFamily: MARKETPLACE.font, fontSize: 12, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: ARCOVA.paper, color: ARCOVA.ink, fontFamily: ARCOVA.font, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: NOVA.black, color: NOVA.cream, fontFamily: NOVA.font, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: PREMIUM.bg, color: PREMIUM.ink, fontFamily: PREMIUM.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: "#fff", color: HOMEVISTA.ink, fontFamily: HOMEVISTA.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
        <HomeVistaHeader store={store} slug={slug} navCategories={navCategories} />
        <HomeVistaCartClient slug={slug} />
        <HomeVistaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (rrw && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: RRW.ink, fontFamily: RRW.font, minHeight: "100vh" }} className="storefront-root">
        <RrwHeader store={store} slug={slug} navCategories={navCategories} />
        <RrwCartClient slug={slug} />
        <RrwFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (heenzy && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    return (
      <>
        <HeenzyHeader store={store} slug={slug} navCategories={navCategories} />
        <HeenzyCartClient slug={slug} />
        <HeenzyFooter store={store} slug={slug} navCategories={navCategories} />
      </>
    );
  }

  if (rivora && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#f7f9f6", minHeight: "100vh" }} className="storefront-root">
        <RivoraHeader store={store} slug={slug} navCategories={navCategories} />
        <RivoraCartClient slug={slug} />
        <RivoraFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (fabtex && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: FABTEX.dark, minHeight: "100vh" }} className="storefront-root">
        <FabtexHeader store={store} slug={slug} navCategories={navCategories} />
        <FabtexCartClient slug={slug} />
        <FabtexFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (juicelife && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#ffffff", minHeight: "100vh" }} className="storefront-root">
        <JuiceLifeHeader store={store} slug={slug} navCategories={navCategories} />
        <JuiceLifeCartClient slug={slug} />
        <JuiceLifeFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return <CartClient slug={slug} />;
}
