import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, isPremiumTemplate, isHomeVistaTemplate, isRrwTemplate, isHeenzyTemplate, isRivoraTemplate, isFabtexTemplate, isJuiceLifeTemplate, type TemplateTheme } from "@/lib/template-themes";
import { ProductDetail } from "@/components/storefront/product-detail";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { VioletHeader, VioletFooter, wrap as violetWrap } from "@/components/storefront/templates/violet-chrome";
import { MarketplaceHeader, MarketplaceFooter, wrap as marketplaceWrap } from "@/components/storefront/templates/marketplace-chrome";
import { ArcovaHeader, ArcovaFooter, wrap as arcovaWrap } from "@/components/storefront/templates/arcova-chrome";
import { NovaHeader, NovaFooter, wrap as novaWrap } from "@/components/storefront/templates/nova-chrome";
import { PremiumHeader, PremiumFooter, wrap as premiumWrap } from "@/components/storefront/templates/premium-chrome";
import { HomeVistaHeader, HomeVistaFooter, wrap as homevistaWrap } from "@/components/storefront/templates/homevista-chrome";
import { RrwHeader, RrwFooter, wrap as rrwWrap } from "@/components/storefront/templates/rrw-chrome";
import { HeenzyHeader, HeenzyFooter, wrap as heenzyWrap } from "@/components/storefront/templates/heenzy-chrome";
import { RivoraHeader, RivoraFooter, wrap as rivoraWrap } from "@/components/storefront/templates/rivora-chrome";
import { FabtexHeader, FabtexFooter, wrap as fabtexWrap } from "@/components/storefront/templates/fabtex-chrome";
import { JuiceLifeHeader, JuiceLifeFooter, wrap as juicelifeWrap } from "@/components/storefront/templates/juicelife-chrome";
import { FreshHeader, FreshFooter, wrap as freshWrap } from "@/components/storefront/templates/fresh-chrome";
import { getStoreCategoryTree } from "@/lib/storefront-categories";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const product = await prisma.product.findFirst({ where: { id: productId, store: { slug } } });
  if (!product) return {};
  return { title: `${product.name} — ${slug}`, description: product.description?.slice(0, 150) };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { template: true, business: true },
  });
  if (!store || store.status !== "ACTIVE") notFound();

  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: store.id, isPublished: true },
    include: { category: true, inventory: true },
  });
  if (!product) notFound();

  // Fire-and-forget: never await-block a buyer's page render on analytics.
  void recordStoreVisit(store.id, `/store/${slug}/product/${productId}`);

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  // This template's own real palette/radius (see catalog/page.tsx for why
  // the old Heenzy-only fallback made every other template's product page
  // look like Fresh & Co. regardless of the store's actual template).
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const { accent, ink, bg, radius } = theme;

  const inStock = product.type !== "PHYSICAL" || !product.inventory || product.inventory.quantity > 0;

  const productDetail = (
    <ProductDetail
      storeSlug={slug}
      productId={product.id}
      name={product.name}
      price={Number(product.price)}
      compareAtPrice={product.compareAtPrice ? Number(product.compareAtPrice) : null}
      currency={product.currency}
      images={product.images}
      description={product.description}
      categoryName={product.category?.name ?? null}
      type={product.type}
      rentalUnit={product.rentalPeriodUnit}
      inStock={inStock}
      accent={accent}
      ink={ink}
      radius={radius}
    />
  );

  const crumbs = (
    <>
      <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
      {" / "}
      {product.category?.name ? <>{product.category.name}{" / "}</> : null}
      <span>{product.name}</span>
    </>
  );

  if (isVioletTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <VioletHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...violetWrap, padding: "22px 0 80px" }}>{productDetail}</div>
        <VioletFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isMarketplaceTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ fontFamily: theme.font, color: ink, background: "#fff", fontSize: 12, minHeight: "100vh" }} className="storefront-root">
        <MarketplaceHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...marketplaceWrap, padding: "18px 0 60px" }}>{productDetail}</div>
        <MarketplaceFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isArcovaTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <ArcovaHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...arcovaWrap, padding: "30px 0 70px" }}>{productDetail}</div>
        <ArcovaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isNovaTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <NovaHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...novaWrap, padding: "40px 0 80px" }}>{productDetail}</div>
        <NovaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isPremiumTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
        <PremiumHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...premiumWrap, padding: "22px 0 60px" }}>{productDetail}</div>
        <PremiumFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isHomeVistaTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: ink, fontFamily: theme.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
        <HomeVistaHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...homevistaWrap, padding: "22px 0 60px" }}>{productDetail}</div>
        <HomeVistaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isRrwTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <RrwHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...rrwWrap, padding: "22px 6% 0" }}>{productDetail}</div>
        <RrwFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isHeenzyTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    return (
      <>
        <HeenzyHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...heenzyWrap, padding: "26px 24px 60px" }}>{productDetail}</div>
        <HeenzyFooter store={store} slug={slug} navCategories={navCategories} />
      </>
    );
  }

  if (isRivoraTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#f7f9f6", color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <RivoraHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...rivoraWrap, padding: "26px 0 60px" }}>{productDetail}</div>
        <RivoraFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isFabtexTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <FabtexHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...fabtexWrap, padding: "26px 0 60px" }}>{productDetail}</div>
        <FabtexFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isJuiceLifeTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#ffffff", color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <JuiceLifeHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...juicelifeWrap, padding: "26px 0 60px" }}>{productDetail}</div>
        <JuiceLifeFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  // Fresh & Co. — the platform's base/default template. Every other
  // template now has its own chrome (see imports above); this was the
  // last one still falling back to a bare, undersized nav bar with no
  // category strip, hero styling, or footer to match its homepage.
  const navCategories = await getStoreCategoryTree(store.id);
  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }} className="storefront-root">
      <FreshHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
      <div style={{ ...freshWrap, padding: "26px 28px 60px" }}>{productDetail}</div>
      <FreshFooter store={store} slug={slug} catalogLabel="Catalog" />
    </div>
  );
}
