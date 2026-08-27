import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { isHeenzyTemplate, isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, isPremiumTemplate, isHomeVistaTemplate, isRrwTemplate, isRivoraTemplate, isFabtexTemplate, isJuiceLifeTemplate, VIOLET, MARKETPLACE, ARCOVA, NOVA, PREMIUM, HOMEVISTA, RRW, FABTEX } from "@/lib/template-themes";
import { CheckoutClient } from "./checkout-client";
import { HeenzyCheckoutClient } from "./heenzy-checkout-client";
import { VioletCheckoutClient } from "./violet-checkout-client";
import { MarketplaceCheckoutClient } from "./marketplace-checkout-client";
import { ArcovaCheckoutClient } from "./arcova-checkout-client";
import { NovaCheckoutClient } from "./nova-checkout-client";
import { PremiumCheckoutClient } from "./premium-checkout-client";
import { HomeVistaCheckoutClient } from "./homevista-checkout-client";
import { RrwCheckoutClient } from "./rrw-checkout-client";
import { RivoraCheckoutClient } from "./rivora-checkout-client";
import { FabtexCheckoutClient } from "./fabtex-checkout-client";
import { JuiceLifeCheckoutClient } from "./juicelife-checkout-client";
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
import { isSignatureTemplate, getSignatureTheme } from "@/lib/template-themes";
import { SignatureCheckoutClient } from "@/components/storefront/signature-checkout-client";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });

  // Browsing and building a cart stay open to everyone — this is the one
  // gate before an actual order gets placed. Sending both `callbackUrl`
  // (so login returns straight to this store's checkout) and `store` (so
  // the login page picks up this store's branding) matches how the rest
  // of the auth flow already reads those two params — see LoginForm.
  const session = await getStoreCustomerSessionForStore(slug);
  if (!session?.user?.id) {
    const callbackUrl = `/store/${slug}/checkout`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&store=${encodeURIComponent(slug)}`);
  }
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

  // Signature templates own the complete customer checkout surface. The
  // payment/order engine remains shared by submitCheckout; only presentation
  // and copy are template-specific.
  if (store && isSignatureTemplate(store.template?.name)) {
    const theme = getSignatureTheme(store.template?.name);
    return (
      <div style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font, minHeight: "100vh", ["--sig-headline" as string]: theme.headlineFont, ["--sig-font" as string]: theme.font }} className="storefront-root">
        <SignatureCheckoutClient slug={slug} templateName={store.template?.name ?? ""} />
      </div>
    );
  }

  if (violet && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: VIOLET.bg, color: VIOLET.ink, fontFamily: VIOLET.font, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: "#fff", color: MARKETPLACE.ink, fontFamily: MARKETPLACE.font, fontSize: 12, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: ARCOVA.paper, color: ARCOVA.ink, fontFamily: ARCOVA.font, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: NOVA.black, color: NOVA.cream, fontFamily: NOVA.font, minHeight: "100vh" }} className="storefront-root">
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
      <div style={{ background: PREMIUM.bg, color: PREMIUM.ink, fontFamily: PREMIUM.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
        <PremiumHeader store={store} slug={slug} navCategories={navCategories} />
        <PremiumCheckoutClient slug={slug} />
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
        <HomeVistaCheckoutClient slug={slug} />
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
        <RrwCheckoutClient slug={slug} />
        <RrwFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (heenzy && store) {
    const navCategories = await getStoreCategoryTree(store.id);
    return (
      <>
        <HeenzyHeader store={store} slug={slug} navCategories={navCategories} />
        <HeenzyCheckoutClient slug={slug} />
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
        <RivoraCheckoutClient slug={slug} />
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
        <FabtexCheckoutClient slug={slug} />
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
        <JuiceLifeCheckoutClient slug={slug} />
        <JuiceLifeFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return <CheckoutClient slug={slug} />;
}
