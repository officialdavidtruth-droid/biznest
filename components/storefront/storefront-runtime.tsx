import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { readBuilderConfig, defaultBuilderConfig } from "@/lib/builder-config";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { getExampleContent } from "@/lib/example-content";
import { getHotelContent } from "@/lib/hotel-content";
import { getTemplateDefinition } from "@/lib/template-registry";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { getCanonicalBusinessType, isHotelBusiness, isRestaurantBusiness } from "@/lib/business-identity";
import { resolveStoreTheme } from "@/lib/template-themes";
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";
import { LegacyTemplateHome } from "@/components/storefront/legacy-template-renderer";
import { SignatureScreenshotHome } from "@/components/storefront/signature-screenshot-home";

type CatalogItem={id:string;kind:"product"|"service";name:string;description:string|null;price:number;currency:string;image:string|null;categoryName:string|null;type:string;rentalUnit:string|null;isBookable:boolean;hasVariants?:boolean};

export const getStoreForSlug=cache((slug:string)=>prisma.store.findUnique({where:{slug},include:{template:true,business:true,products:{where:{isPublished:true},take:24,include:{category:true}},services:{where:{isPublished:true},take:24,include:{category:true}},reviews:{include:{author:true},orderBy:{createdAt:"desc"},take:6}}}));

export async function renderStorefront(slug:string){
 const raw=await getStoreForSlug(slug);if(!raw||raw.status!=="ACTIVE")notFound();
 const store={...raw,sellsProducts:raw.business?.sellsProducts??true}; void recordStoreVisit(store.id,`/${slug}`);
 const catalogItems:CatalogItem[]=[...store.products.map(p=>({id:p.id,kind:"product" as const,name:p.name,description:p.description??null,price:Number(p.price),currency:p.currency,image:p.images[0]??null,categoryName:p.category?.name??null,type:p.type,rentalUnit:p.rentalPeriodUnit,isBookable:false,hasVariants:p.hasVariants})),...store.services.map(s=>({id:s.id,kind:"service" as const,name:s.name,description:s.description,price:Number(s.price),currency:s.currency,image:s.images[0]??null,categoryName:s.category?.name??null,type:"SERVICE",rentalUnit:null,isBookable:s.isBookable}))];
 const businessType=getCanonicalBusinessType({businessCategory:store.business?.category,storeBusinessType:store.businessType});
 const template=getTemplateDefinition(store.template?.name);
 const templateName=store.template?.name ?? "";
 // Real category menu. This used to be a hard-coded [] while /template-preview passes sample
 // categories, so every category menu / sidebar / chip row the preview shows was missing on the live page.
 const dbCats=await prisma.category.findMany({where:{storeId:store.id,isActive:true,parentId:null},orderBy:{sortOrder:"asc"},take:12,include:{children:{where:{isActive:true},orderBy:{sortOrder:"asc"},take:12}}}).catch(()=>[] as any[]);
 let navCategories:any[]=dbCats.map((c:any)=>({id:c.id,name:c.name,children:(c.children??[]).map((ch:any)=>({id:ch.id,name:ch.name,children:[]}))}));
 if(!navCategories.length){const seen=new Set<string>();navCategories=catalogItems.filter(i=>i.categoryName&&!seen.has(i.categoryName)&&seen.add(i.categoryName)).slice(0,12).map((i,n)=>({id:`cat-${n}`,name:i.categoryName as string,children:[]}));}
 const goodReviews=(store.reviews??[]).filter((r:any)=>r.rating>=4&&r.comment);
 const social=(store.socialLinks as Record<string,string>|null)??{};
 // Real completed-order count for the "Completed orders" stat (was a hard-coded 0).
 const completedOrders=await prisma.order.count({where:{storeId:store.id,status:"COMPLETED"}}).catch(()=>0);
 const avgRating=store.business?.avgRating??null;
 // One resolver decides the homepage component for runtime AND preview.
 const home=resolveHomeRenderer(templateName);
 if(home.kind==="legacy") return <LegacyTemplateHome name={home.name} p={{store,slug,catalogItems,navCategories,goodReviews,avgRating,completedOrders,trustScore:null,trustChecklist:null,social}}/>;
 if(home.kind==="screenshot") return <SignatureScreenshotHome store={store} slug={slug} items={catalogItems as any} reviews={store.reviews} avgRating={avgRating} completedOrders={completedOrders} social={social} mode={home.mode} {...home.palette}/>;
 if(home.kind==="example") return <ExampleStorefront store={store} slug={slug} items={catalogItems} mode="home" content={await getExampleContent(slug) as any}/>;
 if(home.kind==="hotel") return <ThelusoHotel store={store} slug={slug} content={await getHotelContent(slug)}/>;

 const themeOverrides = store.themeColors as {primary?:string;secondary?:string;accent?:string}|null;
 const rawSectionOverrides = store.sectionOverrides as { builderVersion?: number; builder?: unknown } | null;
 const savedBuilder = rawSectionOverrides?.builderVersion===1 ? readBuilderConfig(rawSectionOverrides.builder) : null;
 if(savedBuilder) {
   // Older saved builder drafts can omit the hero or retain it as hidden.
   // Keep the user's saved section order/content, but guarantee a visible
   // homepage hero using the active template's own hero settings as fallback.
   const theme=resolveStoreTheme(store.template?.category,store.name,themeOverrides,store.fontFamily,store.template?.name);
   const templateConfig=templateThemeToBuilderConfig(theme,store.name,store.business?.description,store.bannerUrl);
   const fallbackHero=templateConfig.sections.find((section)=>section.type==="hero");
   const heroIndex=savedBuilder.sections.findIndex((section)=>section.type==="hero");
   const sections=[...savedBuilder.sections];
   if(heroIndex<0 && fallbackHero) sections.unshift(fallbackHero);
   else if(heroIndex>=0 && !sections[heroIndex].visible) sections[heroIndex]={...sections[heroIndex],visible:true};
   return <BuilderStorefront store={store} config={{...savedBuilder,sections}} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={completedOrders}/>;
 }

 if(template?.home==="builder") {
   const theme=resolveStoreTheme(store.template?.category,store.name,themeOverrides,store.fontFamily,store.template?.name);
   const config=templateThemeToBuilderConfig(theme,store.name,store.business?.description,store.bannerUrl);
   return <BuilderStorefront store={store} config={config} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={completedOrders}/>;
 }

 return <BuilderStorefront store={store} config={defaultBuilderConfig(store.name,store.business?.description,store.bannerUrl,store.business?.category,{sellsProducts:store.business?.sellsProducts,offersServices:store.business?.offersServices})} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={completedOrders}/>;
}
export default renderStorefront;
