import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveStoreTheme } from "@/lib/template-themes";
import { ProductDetail } from "@/components/storefront/product-detail";
import { recordStoreVisit } from "@/lib/actions/analytics";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const product = await prisma.product.findFirst({ where: { id: productId, store: { slug } } });
  return product ? { title: `${product.name} — ${slug}`, description: product.description?.slice(0, 150) } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const product = await prisma.product.findFirst({ where: { id: productId, storeId: store.id, isPublished: true }, include: { category: true, inventory: true, variants: { where: { isActive: true }, select: { quantity: true } } } });
  if (!product) notFound();
  void recordStoreVisit(store.id, `/${slug}/product/${productId}`);
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  const inStock = product.type !== "PHYSICAL" || (product.hasVariants ? product.variants.some(v => v.quantity > 0) : !product.inventory || product.inventory.quantity > 0);
  return <main style={{minHeight:"100vh",background:theme.bg,color:theme.ink,fontFamily:theme.font,padding:"5rem 2rem"}}><ProductDetail storeSlug={slug} productId={product.id} name={product.name} price={Number(product.price)} compareAtPrice={product.compareAtPrice ? Number(product.compareAtPrice) : null} currency={product.currency} images={product.images} description={product.description} categoryName={product.category?.name ?? null} type={product.type} rentalUnit={product.rentalPeriodUnit} inStock={inStock} accent={theme.accent} ink={theme.ink} radius={theme.radius}/></main>;
}
