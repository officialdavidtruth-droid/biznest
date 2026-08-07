import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, FRESH, isHeenzyTemplate, type TemplateTheme } from "@/lib/template-themes";
import { HEENZY } from "@/lib/template-themes";
import { ProductDetail } from "@/components/storefront/product-detail";
import { CartLink } from "@/components/storefront/cart-link";

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
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const heenzy = isHeenzyTemplate(store.template?.name);
  const accent = heenzy ? HEENZY.black : FRESH.leaf;
  const ink = heenzy ? HEENZY.black : FRESH.ink;
  const bg = heenzy ? HEENZY.white : FRESH.ivory;
  const radius = heenzy ? "10px" : "0.9rem";

  const inStock = product.type !== "PHYSICAL" || !product.inventory || product.inventory.quantity > 0;

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${bg}f2`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${ink}14` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href={`/store/${slug}`} style={{ fontWeight: 800, fontSize: 18, color: ink, textDecoration: "none" }}>{store.name}</Link>
          <CartLink storeSlug={slug} accent={accent} ink={ink} />
        </div>
      </nav>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 28px 80px" }}>
        <div style={{ fontSize: 12.5, marginBottom: 22, opacity: 0.65 }}>
          <Link href={`/store/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
          {" / "}
          {product.category?.name ? <>{product.category.name}{" / "}</> : null}
          <span>{product.name}</span>
        </div>

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
      </div>
    </div>
  );
}
