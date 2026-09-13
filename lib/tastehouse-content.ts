import { prisma } from "@/lib/prisma";

export const TASTEHOUSE_TEMPLATE_NAME = "TasteHouse — Food Delivery";
export type TasteHouseContent = {
  heroTitle:string; heroAccent:string; heroSubtitle:string; heroImage:string;
  firstOfferTitle:string; firstOfferText:string; firstOfferImage:string;
  secondOfferTitle:string; secondOfferText:string; secondOfferImage:string;
  supportEmail:string; supportPhone:string;
};
export const DEFAULT_TASTEHOUSE_CONTENT:TasteHouseContent={
 heroTitle:"Delicious Food", heroAccent:"Delivered Fast.", heroSubtitle:"Discover the best restaurants, cuisines and exclusive offers near you.",
 heroImage:"/tastehouse/burger2.jpg", firstOfferTitle:"Flat 30% OFF", firstOfferText:"On Your First Order!", firstOfferImage:"/tastehouse/chicken.jpg",
 secondOfferTitle:"Family Combo Meals", secondOfferText:"Feed your family with our special combo deals.", secondOfferImage:"/tastehouse/combo.jpg",
 supportEmail:"support@tastehouse.com", supportPhone:"+234 803 123 4567"
};
export async function getTasteHouseContent(slug:string){
 const store=await prisma.store.findUnique({where:{slug},select:{id:true,contactEmail:true,contactPhone:true,bannerUrl:true}}); if(!store)return DEFAULT_TASTEHOUSE_CONTENT;
 const page=await prisma.storePage.findUnique({where:{storeId_slug:{storeId:store.id,slug:"tastehouse-home"}}});
 const v=(page?.content&&typeof page.content==="object"&&!Array.isArray(page.content)?page.content:{}) as Partial<TasteHouseContent>;
 return {...DEFAULT_TASTEHOUSE_CONTENT,...v,heroImage:v.heroImage||store.bannerUrl||DEFAULT_TASTEHOUSE_CONTENT.heroImage,supportEmail:v.supportEmail||store.contactEmail||DEFAULT_TASTEHOUSE_CONTENT.supportEmail,supportPhone:v.supportPhone||store.contactPhone||DEFAULT_TASTEHOUSE_CONTENT.supportPhone};
}