import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { readBuilderConfig, defaultBuilderConfig } from "@/lib/builder-config";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { GrandeurHome } from "@/components/storefront/grandeur-restaurant";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { TasteHouseHome } from "@/components/storefront/tastehouse";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { getTasteHouseContent } from "@/lib/tastehouse-content";
import { getExampleContent } from "@/lib/example-content";
import { getHotelContent } from "@/lib/hotel-content";
import { getTemplateDefinition } from "@/lib/template-registry";
import { getCanonicalBusinessType, isHotelBusiness, isRestaurantBusiness } from "@/lib/business-identity";

type CatalogItem={id:string;kind:"product"|"service";name:string;description:string|null;price:number;currency:string;image:string|null;categoryName:string|null;type:string;rentalUnit:string|null;isBookable:boolean;hasVariants?:boolean};
export const getStoreForSlug=cache((slug:string)=>prisma.store.findUnique({where:{slug},include:{template:true,business:true,products:{where:{isPublished:true},take:24,include:{category:true}},services:{where:{isPublished:true},take:24,include:{category:true}},reviews:{include:{author:true},orderBy:{createdAt:"desc"},take:6}}}));
export async function renderStorefront(slug:string){
 const raw=await getStoreForSlug(slug);if(!raw||raw.status!=="ACTIVE")notFound();
 const store={...raw,sellsProducts:raw.business?.sellsProducts??true}; void recordStoreVisit(store.id,`/${slug}`);
 const catalogItems:CatalogItem[]=[...store.products.map(p=>({id:p.id,kind:"product" as const,name:p.name,description:null,price:Number(p.price),currency:p.currency,image:p.images[0]??null,categoryName:p.category?.name??null,type:p.type,rentalUnit:p.rentalPeriodUnit,isBookable:false,hasVariants:p.hasVariants})),...store.services.map(s=>({id:s.id,kind:"service" as const,name:s.name,description:s.description,price:Number(s.price),currency:s.currency,image:s.images[0]??null,categoryName:s.category?.name??null,type:"SERVICE",rentalUnit:null,isBookable:s.isBookable}))];
 const businessType=getCanonicalBusinessType({businessCategory:store.business?.category,storeBusinessType:store.businessType}); const template=getTemplateDefinition(store.template?.name);
 if(template?.renderer==="tastehouse") return <TasteHouseHome store={store} slug={slug} items={catalogItems} content={await getTasteHouseContent(slug)}/>;
 if(template?.renderer==="example") return <ExampleStorefront store={store} slug={slug} items={catalogItems} mode="home" content={await getExampleContent(slug) as any}/>;
 if(isRestaurantBusiness(businessType)) return <GrandeurHome store={store} slug={slug} items={catalogItems} reviews={store.reviews}/>;
 if(template?.renderer==="hotel"||isHotelBusiness(businessType)) return <ThelusoHotel store={store} slug={slug} content={await getHotelContent(slug)}/>;
 const overrides=store.sectionOverrides as {builderVersion?:number;builder?:unknown}|null;
 const builderConfig=overrides?.builderVersion===1?readBuilderConfig(overrides.builder):null;
 if(builderConfig) return <BuilderStorefront store={store} config={builderConfig} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0}/>;
 const fallbackConfig=defaultBuilderConfig(store.name,store.business?.description,store.bannerUrl,store.business?.category,{sellsProducts:store.business?.sellsProducts,offersServices:store.business?.offersServices});
 return <BuilderStorefront store={store} config={fallbackConfig} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0}/>;
}
export default renderStorefront;
