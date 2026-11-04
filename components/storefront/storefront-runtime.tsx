import { cache, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPublicTravelPackages } from "@/lib/travel-public";
import { prisma } from "@/lib/prisma";
import { recordStoreVisit } from "@/lib/actions/analytics";
import { defaultBuilderConfig } from "@/lib/builder-config";
import { BuilderStorefront } from "@/components/storefront/builder-renderer";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { ExampleStorefront } from "@/components/storefront/example-store";
import { getExampleContent } from "@/lib/example-content";
import { getHotelContent } from "@/lib/hotel-content";
import { getTemplateDefinition } from "@/lib/template-registry";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { getSavedBuilder } from "@/lib/storefront/saved-builder";
import { applySectionHeadings, getSectionHeadings } from "@/lib/storefront/section-headings";
import { faqFromStoreOverrides } from "@/lib/builder-defaults";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getCanonicalBusinessType, isHotelBusiness, isRestaurantBusiness } from "@/lib/business-identity";
import { resolveStoreTheme } from "@/lib/template-themes";
import { templateThemeToBuilderConfig } from "@/lib/template-builder-config";
import { SectionArranger } from "@/components/storefront/section-arranger";
import { getTemplateArrangement } from "@/lib/storefront/arrangement";
import { SignatureScreenshotHome } from "@/components/storefront/signature-screenshot-home";

type CatalogItem={id:string;kind:"product"|"service";name:string;description:string|null;price:number;currency:string;image:string|null;categoryName:string|null;type:string;rentalUnit:string|null;isBookable:boolean;hasVariants?:boolean};

export const getStoreForSlug=cache((slug:string)=>prisma.store.findUnique({where:{slug},include:{template:true,business:true,products:{where:{isPublished:true},take:24,include:{category:true}},services:{where:{isPublished:true},take:24,include:{category:true}},reviews:{include:{author:{select:{name:true}}},orderBy:{createdAt:"desc"},take:6}}}));

export async function renderStorefront(slug:string,opts?:{preview?:boolean}){
 const raw=await getStoreForSlug(slug);if(!raw||raw.status!=="ACTIVE")notFound();
 const store={...raw,sellsProducts:raw.business?.sellsProducts??true}; void recordStoreVisit(store.id,`/${slug}`);
 const catalogItems:CatalogItem[]=[...store.products.map(p=>({id:p.id,kind:"product" as const,name:p.name,description:p.description??null,price:Number(p.price),currency:p.currency,image:p.images[0]??null,categoryName:p.category?.name??null,type:p.type,rentalUnit:p.rentalPeriodUnit,isBookable:false,hasVariants:p.hasVariants})),...store.services.map(s=>({id:s.id,kind:"service" as const,name:s.name,description:s.description,price:Number(s.price),currency:s.currency,image:s.images[0]??null,categoryName:s.category?.name??null,type:"SERVICE",rentalUnit:null,isBookable:s.isBookable}))];
 const businessType=getCanonicalBusinessType({businessCategory:store.business?.category,storeBusinessType:store.businessType});
 const template=getTemplateDefinition(store.template?.name);
 const templateName=store.template?.name ?? "";
 // Real category menu. This used to be a hard-coded [] while /template-preview passes sample
 // categories, so every category menu / sidebar / chip row the preview shows was missing on the live page.
 const dbCats=await prisma.category.findMany({where:{storeId:store.id,isActive:true,parentId:null},orderBy:{sortOrder:"asc"},take:12,include:{children:{where:{isActive:true},orderBy:{sortOrder:"asc"},take:12}}}).catch(()=>[] as any[]);
 let navCategories:any[]=dbCats.map((c:any)=>({id:c.id,name:c.name,slug:c.slug,children:(c.children??[]).map((ch:any)=>({id:ch.id,name:ch.name,slug:ch.slug,children:[]}))}));
 if(!navCategories.length){const seen=new Set<string>();navCategories=catalogItems.filter(i=>i.categoryName&&!seen.has(i.categoryName)&&seen.add(i.categoryName)).slice(0,12).map((i,n)=>({id:`cat-${n}`,name:i.categoryName as string,children:[]}));}
 // Open group departures (BizNest Travel). Empty for every store without the plugin or without open departures.
 const departures=await getPublicTravelPackages(store.id).catch(()=>[]);
 const goodReviews=(store.reviews??[]).filter((r:any)=>r.rating>=4&&r.comment);
 const social=(store.socialLinks as Record<string,string>|null)??{};
 // Real completed-order count for the "Completed orders" stat (was a hard-coded 0).
 const completedOrders=await prisma.order.count({where:{storeId:store.id,status:"COMPLETED"}}).catch(()=>0);
 const avgRating=store.business?.avgRating??null;
 // One resolver decides the homepage component for runtime AND preview.
 const home=resolveHomeRenderer(templateName,{businessCategory:store.business?.category,storeBusinessType:store.businessType});
 const themeOverrides = store.themeColors as {primary?:string;secondary?:string;accent?:string}|null;
 const sectionOverridesRaw = store.sectionOverrides as { faq?: unknown } | null;
 const fallbackFaq = faqFromStoreOverrides(sectionOverridesRaw?.faq);
 // A published visual-builder layout is the owner's explicit choice, so it wins over EVERY template's own
 // homepage (legacy, hotel, screenshot, example). Before, those were drawn first and "Website published"
 // changed nothing for 24 of the 44 templates.
 const savedBuilder = getSavedBuilder(store.sectionOverrides);
 if(savedBuilder) {
   // Older saved builder drafts can omit the hero or retain it as hidden.
   // Keep the user's saved section order/content, but guarantee a visible
   // homepage hero using the active template's own hero settings as fallback.
   const theme=resolveStoreTheme(store.template?.category,store.name,themeOverrides,store.fontFamily,store.template?.name);
   const templateConfig=templateThemeToBuilderConfig(home.kind==="builder"?{...theme,neutral:true}:theme,store.name,store.business?.description,store.bannerUrl,{category:store.business?.category,subcategory:store.business?.businessSubcategory,sellsProducts:store.business?.sellsProducts,offersServices:store.business?.offersServices});
   const fallbackHero=templateConfig.sections.find((section)=>section.type==="hero");
   const heroIndex=savedBuilder.sections.findIndex((section)=>section.type==="hero");
   const sections=[...savedBuilder.sections];
   if(heroIndex<0 && fallbackHero) sections.unshift(fallbackHero);
   else if(heroIndex>=0 && !sections[heroIndex].visible) sections[heroIndex]={...sections[heroIndex],visible:true};
   return <BuilderStorefront categoryList={navCategories} departures={departures} store={store} config={{...savedBuilder,sections}} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={completedOrders} fallbackFaq={fallbackFaq}/>;
 }

 // The Customize editor's live preview (/store/<slug>?preview=1) must show the builder draft even for a template
 // that draws its own homepage and has nothing published yet; otherwise the preview never reacts to edits.
 // Only for signed-in people with access to this store, so the public never sees a different homepage.
 if(opts?.preview && home.kind!=="builder") {
   const access=await assertStorePermission(slug,"settings").catch(()=>({success:false as const}));
   if(access.success) return <BuilderStorefront categoryList={navCategories} departures={departures} store={store} config={defaultBuilderConfig(store.name,store.business?.description,store.bannerUrl,store.business?.category,{sellsProducts:store.business?.sellsProducts,offersServices:store.business?.offersServices})} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={completedOrders} fallbackFaq={fallbackFaq}/>;
 }

 const arrangement=getTemplateArrangement(store.sectionOverrides);
 const arranged=(node:ReactNode)=><SectionArranger arrangement={arrangement}>{node}</SectionArranger>;
 if(home.kind==="screenshot") return arranged(<SignatureScreenshotHome store={store} slug={slug} items={catalogItems as any} reviews={store.reviews} avgRating={avgRating} completedOrders={completedOrders} social={social} mode={home.mode} {...home.palette}/>);
 if(home.kind==="example") return arranged(<ExampleStorefront store={store} slug={slug} items={catalogItems} mode="home" content={await getExampleContent(slug) as any}/>);
 if(home.kind==="hotel") return arranged(<ThelusoHotel store={store} slug={slug} content={await getHotelContent(slug)}/>);

 if(home.kind==="builder") {
   const theme=resolveStoreTheme(store.template?.category,store.name,themeOverrides,store.fontFamily,store.template?.name);
   const baseConfig=templateThemeToBuilderConfig(home.kind==="builder"?{...theme,neutral:true}:theme,store.name,store.business?.description,store.bannerUrl,{category:store.business?.category,subcategory:store.business?.businessSubcategory,sellsProducts:store.business?.sellsProducts,offersServices:store.business?.offersServices});
   // The owner's Content-panel hero text (headline / subtitle / button) wins over the template defaults.
   const ho=(store.heroOverrides??{}) as {headline?:string;subtitle?:string;ctaLabel?:string};
   const config={...baseConfig,sections:applySectionHeadings(baseConfig.sections,getSectionHeadings(store.sectionOverrides)).map((sec:any)=>sec.type!=="hero"?sec:{...sec,settings:{...sec.settings,...(ho.headline?.trim()?{heading:ho.headline.trim()}:{}),...(ho.subtitle?.trim()?{body:ho.subtitle.trim()}:{}),...(ho.ctaLabel?.trim()?{ctaLabel:ho.ctaLabel.trim()}:{})}})};
   return <BuilderStorefront categoryList={navCategories} departures={departures} store={store} config={config} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={completedOrders} fallbackFaq={fallbackFaq}/>;
 }

 return <BuilderStorefront categoryList={navCategories} departures={departures} store={store} config={defaultBuilderConfig(store.name,store.business?.description,store.bannerUrl,store.business?.category,{sellsProducts:store.business?.sellsProducts,offersServices:store.business?.offersServices})} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={completedOrders} fallbackFaq={fallbackFaq}/>;
}
export default renderStorefront;
