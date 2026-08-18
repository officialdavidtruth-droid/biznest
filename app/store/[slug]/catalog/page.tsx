import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, isVioletTemplate, isMarketplaceTemplate, isArcovaTemplate, isNovaTemplate, isPremiumTemplate, isHomeVistaTemplate, isRrwTemplate, isHeenzyTemplate, isRivoraTemplate, isFabtexTemplate, isJuiceLifeTemplate, type TemplateTheme } from "@/lib/template-themes";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNav } from "@/components/storefront/category-nav";
import { getStoreCategoryTree } from "@/lib/storefront-categories";
import { CatalogGrid } from "@/components/storefront/catalog-grid";
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  return { title: store ? `Catalog — ${store.name}` : "Catalog" };
}

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id, isPublished: true }, include: { category: true } }),
    prisma.service.findMany({ where: { storeId: store.id, isPublished: true }, include: { category: true } }),
  ]);

  const items = [
    ...products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null })),
    ...services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null })),
  ];
  // An empty catalog is a real, valid state for a new store — show a
  // friendly message rather than a 404.

  const categories = await getStoreCategoryTree(store.id);

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  // Use this template's own real palette/radius (every template already
  // defines a full theme in lib/template-themes.ts) instead of falling back
  // to the Fresh & Co. look for anything that isn't Heenzy or Nova — that
  // fallback was why every catalog/category page looked the same regardless
  // of which template the store actually uses.
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const { accent, ink, bg, radius } = theme;

  const crumbs = (
    <>
      <Link href={`/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
      {" / "}
      <span>All</span>
    </>
  );

  const body = (
    <>
      <h1 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, marginBottom: 8 }}>Everything at {store.name}</h1>
      <p style={{ fontSize: 13.5, opacity: 0.65, marginBottom: 32 }}>{items.length} {items.length === 1 ? "item" : "items"}</p>

      {items.length === 0 ? (
        <div style={{ border: `1px dashed ${ink}22`, borderRadius: 16, padding: 60, textAlign: "center", opacity: 0.7 }}>
          <p style={{ fontSize: 14 }}>Nothing published here yet — check back soon.</p>
        </div>
      ) : (
        <CatalogGrid items={items} slug={slug} accent={accent} ink={ink} radius={radius} />
      )}
    </>
  );

  if (isVioletTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <VioletHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...violetWrap, padding: "22px 0 80px" }}>{body}</div>
        <VioletFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isMarketplaceTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ fontFamily: theme.font, color: ink, background: "#fff", fontSize: 12, minHeight: "100vh" }} className="storefront-root">
        <MarketplaceHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...marketplaceWrap, padding: "18px 0 60px" }}>{body}</div>
        <MarketplaceFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isArcovaTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <ArcovaHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...arcovaWrap, padding: "30px 0 70px" }}>{body}</div>
        <ArcovaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isNovaTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <NovaHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...novaWrap, padding: "40px 0 80px" }}>{body}</div>
        <NovaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isPremiumTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
        <PremiumHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...premiumWrap, padding: "22px 0 60px" }}>{body}</div>
        <PremiumFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isHomeVistaTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: ink, fontFamily: theme.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
        <HomeVistaHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...homevistaWrap, padding: "22px 0 60px" }}>{body}</div>
        <HomeVistaFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isRrwTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#fff", color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <RrwHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...rrwWrap, padding: "22px 6% 40px" }}>{body}</div>
        <RrwFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isHeenzyTemplate(store.template?.name)) {
    return (
      <>
        <HeenzyHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...heenzyWrap, padding: "26px 24px 60px" }}>{body}</div>
        <HeenzyFooter store={store} slug={slug} navCategories={categories} />
      </>
    );
  }

  if (isRivoraTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#f7f9f6", color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <RivoraHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...rivoraWrap, padding: "26px 0 60px" }}>{body}</div>
        <RivoraFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isFabtexTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <FabtexHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...fabtexWrap, padding: "26px 0 60px" }}>{body}</div>
        <FabtexFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  if (isJuiceLifeTemplate(store.template?.name)) {
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: "#ffffff", color: ink, fontFamily: theme.font, minHeight: "100vh" }} className="storefront-root">
        <JuiceLifeHeader store={store} slug={slug} navCategories={categories} crumbs={crumbs} />
        <div style={{ ...juicelifeWrap, padding: "26px 0 60px" }}>{body}</div>
        <JuiceLifeFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }} className="storefront-root">
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${bg}f2`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${ink}14` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href={`/${slug}`} style={{ fontWeight: 800, fontSize: 18, color: ink, textDecoration: "none" }}>{store.name}</Link>
          <CartLink storeSlug={slug} accent={accent} ink={ink} />
        </div>
      </nav>

      <CategoryNav slug={slug} categories={categories} accent={accent} ink={ink} bg={bg} border={`${ink}14`} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 28px 80px" }}>
        <div style={{ fontSize: 12.5, marginBottom: 22, opacity: 0.65 }}>{crumbs}</div>
        {body}
      </div>
    </div>
  );
}