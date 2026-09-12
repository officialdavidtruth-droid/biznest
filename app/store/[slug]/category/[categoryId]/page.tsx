import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CatalogGrid } from "@/components/storefront/catalog-grid";
import { resolveStoreTheme } from "@/lib/template-themes";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; categoryId: string }> }): Promise<Metadata> {
  const { slug, categoryId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  const category = store ? await prisma.category.findFirst({ where: { id: categoryId, storeId: store.id } }) : null;
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string; categoryId: string }> }) {
  const { slug, categoryId } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId: store.id }, include: { children: true } });
  if (!category) notFound();
  const ids = category.children.length ? [category.id, ...category.children.map(c=>c.id)] : [category.id];
  const [products, services] = await Promise.all([
    prisma.product.findMany({where:{storeId:store.id,categoryId:{in:ids},isPublished:true},include:{category:true}}),
    prisma.service.findMany({where:{storeId:store.id,categoryId:{in:ids},isPublished:true},include:{category:true}}),
  ]);
  const items = [...products.map(p=>({id:p.id,kind:"product" as const,name:p.name,price:Number(p.price),currency:p.currency,image:p.images[0]??null,categoryName:p.category?.name})), ...services.map(s=>({id:s.id,kind:"service" as const,name:s.name,price:Number(s.price),currency:s.currency,image:s.images[0]??null,categoryName:s.category?.name}))];
  if (String(store.business?.category||"").toLowerCase()==="restaurant") {
    const { GrandeurMenu } = await import("@/components/storefront/grandeur-restaurant");
    return <GrandeurMenu store={{...store,sellsProducts:store.business?.sellsProducts??true} as any} slug={slug} items={items.map(i=>({...i,description:null,type:i.kind,rentalUnit:null,isBookable:false})) as any}/>;
  }
  const theme=resolveStoreTheme(store.template?.category,store.name,store.themeColors as any,store.fontFamily,store.template?.name);
  return <main style={{minHeight:"100vh",background:theme.bg,color:theme.ink,fontFamily:theme.font,padding:"6rem 2rem"}}><div style={{maxWidth:1200,margin:"0 auto"}}><p style={{color:theme.accent,fontWeight:700,textTransform:"uppercase"}}>Category</p><h1 style={{fontFamily:theme.headlineFont,marginBottom:32}}>{category.name}</h1><CatalogGrid items={items} slug={slug} accent={theme.accent} ink={theme.ink} radius={theme.radius}/></div></main>;
}
