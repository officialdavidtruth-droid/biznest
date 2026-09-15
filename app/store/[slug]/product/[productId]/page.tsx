import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveStoreTheme } from "@/lib/template-themes";
import { ProductDetail, GrandeurProductDetail } from "@/components/storefront/product-detail";
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
  const product = await prisma.product.findFirst({ where: { id: productId, storeId: store.id, isPublished: true }, include: { category: true, inventory: true, reviews: { include: { author: { select: { name: true } }, response: true }, orderBy: { createdAt: "desc" }, take: 12 }, variants: { where: { isActive: true }, select: { id: true, label: true, optionValues: true, price: true, quantity: true, images: true } } } });
  if (!product) notFound();
  void recordStoreVisit(store.id, `/${slug}/product/${productId}`);
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  const relatedProducts = await prisma.product.findMany({
    where: { storeId: store.id, isPublished: true, id: { not: product.id }, ...(product.categoryId ? { categoryId: product.categoryId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, name: true, price: true, currency: true, images: true, compareAtPrice: true }
  });
  const inStock = product.type !== "PHYSICAL" || (product.hasVariants ? product.variants.some(v => v.quantity > 0) : !product.inventory || product.inventory.quantity > 0);
  const isRestaurant = String(store.business?.category || "").toLowerCase().includes("restaurant") || store.template?.name === "Grandeur — Fine Dining Restaurant";
  const productData = {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
    currency: product.currency,
    images: product.images,
    description: product.description,
    categoryName: product.category?.name ?? null,
    type: product.type,
    rentalUnit: product.rentalPeriodUnit,
    inStock,
    variants: product.variants.map(v => ({ id: v.id, label: v.label, optionValues: v.optionValues as Record<string,string>, price: v.price ? Number(v.price) : null, quantity: v.quantity, images: v.images })),
    reviews: product.reviews.map(r => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt.toISOString(), authorName: r.author?.name || "Guest", response: r.response?.content || null })),
  };
  if (isRestaurant) {
    return <GrandeurProductDetail store={store} slug={slug} product={productData} relatedProducts={relatedProducts.map(p => ({ id:p.id, name:p.name, price:Number(p.price), currency:p.currency, image:p.images[0] || null, compareAtPrice:p.compareAtPrice ? Number(p.compareAtPrice) : null }))} />;
  }
  return <main style={{minHeight:"100vh",background:theme.bg,color:theme.ink,fontFamily:theme.font,padding:"5rem 2rem"}}><ProductDetail storeSlug={slug} productId={product.id} name={product.name} price={Number(product.price)} compareAtPrice={product.compareAtPrice ? Number(product.compareAtPrice) : null} currency={product.currency} images={product.images} description={product.description} categoryName={product.category?.name ?? null} type={product.type} rentalUnit={product.rentalPeriodUnit} inStock={inStock} variants={product.variants.map(v => ({ id: v.id, label: v.label, optionValues: v.optionValues as Record<string,string>, price: v.price ? Number(v.price) : null, quantity: v.quantity, images: v.images }))} accent={theme.accent} ink={theme.ink} radius={theme.radius}/></main>;
}
