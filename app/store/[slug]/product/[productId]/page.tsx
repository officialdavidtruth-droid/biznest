import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, isVioletTemplate, type TemplateTheme } from "@/lib/template-themes";
import { ProductDetail } from "@/components/storefront/product-detail";
import { CartLink } from "@/components/storefront/cart-link";
import { VioletHeader, VioletFooter, wrap as violetWrap } from "@/components/storefront/templates/violet-chrome";
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
      <Link href={`/store/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
      {" / "}
      {product.category?.name ? <>{product.category.name}{" / "}</> : null}
      <span>{product.name}</span>
    </>
  );

  if (isVioletTemplate(store.template?.name)) {
    const navCategories = await getStoreCategoryTree(store.id);
    const social = (store.socialLinks as Record<string, string> | null) ?? {};
    return (
      <div style={{ background: theme.bg, color: ink, fontFamily: theme.font, minHeight: "100vh" }}>
        <VioletHeader store={store} slug={slug} navCategories={navCategories} crumbs={crumbs} />
        <div style={{ ...violetWrap, padding: "22px 0 80px" }}>{productDetail}</div>
        <VioletFooter store={store} slug={slug} social={social} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${bg}f2`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${ink}14` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href={`/store/${slug}`} style={{ fontWeight: 800, fontSize: 18, color: ink, textDecoration: "none" }}>{store.name}</Link>
          <CartLink storeSlug={slug} accent={accent} ink={ink} />
        </div>
      </nav>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 28px 80px" }}>
        <div style={{ fontSize: 12.5, marginBottom: 22, opacity: 0.65 }}>{crumbs}</div>
        {productDetail}
      </div>
    </div>
  );
}
