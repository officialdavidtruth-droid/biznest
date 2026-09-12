import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GrandeurMenu } from "@/components/storefront/grandeur-restaurant";
import { CatalogGrid } from "@/components/storefront/catalog-grid";
import { resolveStoreTheme } from "@/lib/template-themes";

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawStore = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true, products: { where: { isPublished: true }, take: 100, include: { category: true } }, services: { where: { isPublished: true }, take: 100, include: { category: true } } } });
  if (!rawStore || rawStore.status !== "ACTIVE") notFound();
  const store = { ...rawStore, sellsProducts: rawStore.business?.sellsProducts ?? true };
  const items = [
    ...store.products.map(p => ({ id:p.id, kind:"product" as const, name:p.name, price:Number(p.price), currency:p.currency, image:p.images[0] ?? null, categoryName:p.category?.name ?? undefined })),
    ...store.services.map(s => ({ id:s.id, kind:"service" as const, name:s.name, price:Number(s.price), currency:s.currency, image:s.images[0] ?? null, categoryName:s.category?.name ?? undefined })),
  ];
  if (String(store.business?.category || "").toLowerCase() === "restaurant") return <GrandeurMenu store={store} slug={slug} items={items.map(i=>({...i,description:null,type:i.kind,isBookable:false})) as any} />;
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);
  return <main style={{minHeight:"100vh",background:theme.bg,color:theme.ink,fontFamily:theme.font,padding:"6rem 2rem"}}><div style={{maxWidth:1200,margin:"0 auto"}}><h1 style={{fontFamily:theme.headlineFont}}>Catalog</h1><CatalogGrid items={items} slug={slug} accent={theme.accent} ink={theme.ink} radius={theme.radius}/></div></main>;
}
