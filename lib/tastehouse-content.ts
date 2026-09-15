import { prisma } from "@/lib/prisma";

export const TASTEHOUSE_TEMPLATE_NAME = "TasteHouse — Food Delivery";
export type TasteHouseContent = {
  heroTitle:string; heroAccent:string; heroSubtitle:string; heroImage:string;
  firstOfferTitle:string; firstOfferText:string; firstOfferImage:string;
  secondOfferTitle:string; secondOfferText:string; secondOfferImage:string;
  supportEmail:string; supportPhone:string;
};
export const DEFAULT_TASTEHOUSE_CONTENT:TasteHouseContent={
 heroTitle:"Delicious Food", heroAccent:"Made For You.", heroSubtitle:"Explore this business's menu, services and current offers.",
 heroImage:"/tastehouse/burger2.jpg", firstOfferTitle:"Featured Offer", firstOfferText:"Add your promotion here.", firstOfferImage:"/tastehouse/chicken.jpg",
 secondOfferTitle:"Special Selection", secondOfferText:"Showcase your latest menu or promotion here.", secondOfferImage:"/tastehouse/combo.jpg",
 supportEmail:"", supportPhone:""
};
export async function getTasteHouseContent(slug:string){
 const store=await prisma.store.findUnique({where:{slug},select:{id:true,contactEmail:true,contactPhone:true,bannerUrl:true}}); if(!store)return DEFAULT_TASTEHOUSE_CONTENT;
 const page=await prisma.storePage.findUnique({where:{storeId_slug:{storeId:store.id,slug:"tastehouse-home"}}});
 const v=(page?.content&&typeof page.content==="object"&&!Array.isArray(page.content)?page.content:{}) as Partial<TasteHouseContent>;
 return {...DEFAULT_TASTEHOUSE_CONTENT,...v,heroImage:v.heroImage||store.bannerUrl||DEFAULT_TASTEHOUSE_CONTENT.heroImage,supportEmail:v.supportEmail||store.contactEmail||DEFAULT_TASTEHOUSE_CONTENT.supportEmail,supportPhone:v.supportPhone||store.contactPhone||DEFAULT_TASTEHOUSE_CONTENT.supportPhone};
}