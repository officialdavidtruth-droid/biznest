import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { isHotelStore } from "@/lib/storefront-routing";
import type { Metadata } from "next";
import { CatalogExperience } from "@/components/storefront/catalog-experience";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
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

  // Hotel stores have dedicated pages (Amenities, Dining, Gallery...). Their
  // header categories are just nav labels with no products, so the generic
  // product grid would render an empty "0 shown" page. Send each one to the
  // matching hotel page instead.
  if (isHotelStore({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name })) {
    const name = category.name.toLowerCase();
    const target =
      /amenit|facilit/.test(name) ? "/amenities" :
      /dining|restaurant|bar|food/.test(name) ? "/dining" :
      /gallery|photo/.test(name) ? "/gallery" :
      /experience|activit/.test(name) ? "/experiences" :
      /event/.test(name) ? "/events" :
      /about/.test(name) ? "/about" :
      /contact/.test(name) ? "/contact" :
      "/catalog";
    redirect(`/store/${slug}${target}`);
  }
  const ids = category.children.length ? [category.id, ...category.children.map(c=>c.id)] : [category.id];
  const [products, services] = await Promise.all([
    prisma.product.findMany({where:{storeId:store.id,categoryId:{in:ids},isPublished:true},include:{category:true}}),
    prisma.service.findMany({where:{storeId:store.id,categoryId:{in:ids},isPublished:true},include:{category:true}}),
  ]);
  const items = [...products.map(p=>({id:p.id,kind:"product" as const,name:p.name,price:Number(p.price),currency:p.currency,image:p.images[0]??null,categoryName:p.category?.name??null,hasVariants:p.hasVariants})), ...services.map(s=>({id:s.id,kind:"service" as const,name:s.name,price:Number(s.price),currency:s.currency,image:s.images[0]??null,categoryName:s.category?.name??null}))];
  if (String(store.business?.category||"").toLowerCase()==="restaurant") {
    const { GrandeurMenu } = await import("@/components/storefront/grandeur-restaurant");
    return <GrandeurMenu store={{...store,sellsProducts:store.business?.sellsProducts??true} as any} slug={slug} items={items.map(i=>({...i,description:null,type:i.kind,rentalUnit:null,isBookable:false})) as any}/>;
  }
  const theme=resolveStoreTheme(store.template?.category,store.name,store.themeColors as any,store.fontFamily,store.template?.name);
  return (
    <CatalogExperience
      mode="category"
      heading={category.name}
      store={catalogStoreInfo(store, slug)}
      design={catalogDesign(store, theme)}
      items={items}
    />
  );
}
