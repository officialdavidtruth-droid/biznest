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
 const navCategories:any[]=[];
 const goodReviews=(store.reviews??[]).filter((r:any)=>r.rating>=4&&r.comment);
 const legacyNames=new Set(["Fresh & Co.","Heenzy Sneaker Co.","Heenzy — Boutique Rose","Nova Studio — Noir","Nova Studio — Ivory Minimal","Violet","Violet — Sunset","Premium Marketplace","HomeVista","rRW Premium Rental","Marketplace Hub","Arcova Architecture","Rivora Fresh","JuiceLife","Fabtex"]);
 if(legacyNames.has(templateName)) return <LegacyTemplateHome name={templateName} p={{store,slug,catalogItems,navCategories,goodReviews,avgRating:store.business?.avgRating??null,completedOrders:0,trustScore:null,trustChecklist:null,social:(store.socialLinks as Record<string,string>|null)??{}}}/>;
 if(templateName==="Grandeur — Fine Dining Restaurant") return <SignatureScreenshotHome store={store} slug={slug} items={catalogItems as any} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0} social={(store.socialLinks as Record<string,string>|null)??{}} mode="flavora-restaurant" accent="#F39A0B" bg="#100A06" ink="#FFF7EF" card="#17100C" muted="#B7A8A1" border="#352A29" accentSoft="#8C4722" headlineFont="Georgia, serif" font="Inter, sans-serif"/>;
 if(templateName==="TasteHouse — Food Delivery") return <SignatureScreenshotHome store={store} slug={slug} items={catalogItems as any} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0} social={(store.socialLinks as Record<string,string>|null)??{}} mode="tastehouse" accent="#F26B21" bg="#FFFBF5" ink="#241608" card="#FFFFFF" muted="#7A6A5D" border="#F1E4D6" accentSoft="#FDE3D3" headlineFont="Poppins, sans-serif" font="Inter, sans-serif"/>;
 const signatureModeByName: Record<string,string> = {
  "Electra — Smart Commerce":"marketplace",
  "Atelier — Modern Fashion":"fabtex",
  "Kinetic — Sneaker Drop":"heenzy",
  "Bloom — Beauty Boutique":"belora",
  "Haven — Home & Furniture":"arcova",
  "Harvest — Grocery Market":"rivora",
  "Maison — Hotel & Stay":"grand-vere",
  "Grand — Hotel & Hospitality":"great-treasure",
  "Ember — Restaurant":"flavora-restaurant",
  "Muse — Salon & Beauty":"belora",
  "Frame — Photography Studio":"nova",
  "North — Creative Agency":"arcova",
  "Pure — Cleaning Services":"fresh",
  "Forge — Construction":"arcova",
 };
 const screenshotModes = new Set(["great-treasure","grand-vere","belora","tastehouse","flavora-kitchen","flavora-restaurant"]);
 const mappedSignature = signatureModeByName[templateName];
 if(mappedSignature && screenshotModes.has(mappedSignature)) {
   const palette:Record<string,any> = {
    "great-treasure":{accent:"#E7A928",bg:"#07100D",ink:"#F7F3EA",card:"#101815",muted:"#B9B6AF",border:"#2C362F",accentSoft:"#6D5420",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
    "grand-vere":{accent:"#0E5B45",bg:"#FFFFFF",ink:"#15392C",card:"#FFFFFF",muted:"#777",border:"#E6E1D7",accentSoft:"#C8BEA7",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
    "belora":{accent:"#7B4BC0",bg:"#F1EAF8",ink:"#2B2430",card:"#FFFFFF",muted:"#837B89",border:"#E8E0EF",accentSoft:"#D5B7EA",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
    "flavora-restaurant":{accent:"#F39A0B",bg:"#100A06",ink:"#FFF7EF",card:"#17100C",muted:"#B7A8A1",border:"#352A29",accentSoft:"#8C4722",headlineFont:"Georgia, serif",font:"Inter, sans-serif"},
   };
   if(palette[mappedSignature]) return <SignatureScreenshotHome store={store} slug={slug} items={catalogItems as any} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0} social={(store.socialLinks as Record<string,string>|null)??{}} mode={mappedSignature} {...palette[mappedSignature]}/>;
 }
 if(mappedSignature && ["marketplace","fabtex","heenzy","arcova","rivora","nova","fresh"].includes(mappedSignature)) {
   const target = mappedSignature === "heenzy" ? "Heenzy Sneaker Co." : mappedSignature === "fabtex" ? "Fabtex" : mappedSignature === "marketplace" ? "Marketplace Hub" : mappedSignature === "arcova" ? "Arcova Architecture" : mappedSignature === "rivora" ? "Rivora Fresh" : mappedSignature === "nova" ? "Nova Studio — Noir" : "Fresh & Co.";
   return <LegacyTemplateHome name={target} p={{store,slug,catalogItems,navCategories,goodReviews,avgRating:store.business?.avgRating??null,completedOrders:0,trustScore:null,trustChecklist:null,social:(store.socialLinks as Record<string,string>|null)??{}}}/>;
 }


 // Preserve the existing specialized compatibility templates for stores that
 // still use them. Newly restored templates use the hardened Builder renderer.
 if(template?.renderer==="tastehouse") return <TasteHouseHome store={store} slug={slug} items={catalogItems} content={await getTasteHouseContent(slug)}/>;
 if(template?.renderer==="example") return <ExampleStorefront store={store} slug={slug} items={catalogItems} mode="home" content={await getExampleContent(slug) as any}/>;
 if(template?.renderer==="grandeur") return <GrandeurHome store={store} slug={slug} items={catalogItems} reviews={store.reviews}/>;
 if(template?.renderer==="hotel") return <ThelusoHotel store={store} slug={slug} content={await getHotelContent(slug)}/>;

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
   return <BuilderStorefront store={store} config={{...savedBuilder,sections}} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0}/>;
 }

 if(template?.renderer==="builder") {
   const theme=resolveStoreTheme(store.template?.category,store.name,themeOverrides,store.fontFamily,store.template?.name);
   const config=templateThemeToBuilderConfig(theme,store.name,store.business?.description,store.bannerUrl);
   return <BuilderStorefront store={store} config={config} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0}/>;
 }

 return <BuilderStorefront store={store} config={defaultBuilderConfig(store.name,store.business?.description,store.bannerUrl,store.business?.category,{sellsProducts:store.business?.sellsProducts,offersServices:store.business?.offersServices})} catalogItems={catalogItems} reviews={store.reviews} avgRating={store.business?.avgRating??null} completedOrders={0}/>;
}
export default renderStorefront;
