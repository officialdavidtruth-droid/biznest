import { isHotelStore } from "@/lib/storefront-routing"; import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { GrandeurGallery } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { getGrandeurGallery } from "@/lib/grandeur-content";
import { renderBuilderSubpage } from "@/lib/storefront/builder-subpage";
import { getFlavoriaData } from "@/lib/storefront/flavoria-data";
import { FlavoriaGallery, type GalleryPic } from "@/components/storefront/flavoria-pages";
export default async function GalleryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;
const flav=await getFlavoriaData(slug);
if(flav){const page=await prisma.storePage.findUnique({where:{storeId_slug:{storeId:flav.store.id,slug:"template-gallery"}}});const raw:any[]=Array.isArray((page?.content as any)?.items)?(page!.content as any).items:[];const owned:GalleryPic[]=raw.filter(x=>typeof x?.image==="string"&&x.image).map((x,n)=>({id:String(x.id||n),title:String(x.title||"Photo"),category:String(x.category||""),image:x.image}));const pics:GalleryPic[]=owned.length?owned:flav.items.filter(i=>i.image).map(i=>({id:i.id,title:i.name,category:i.categoryName||"",image:i.image as string}));return <FlavoriaGallery store={flav.store} slug={slug} pics={pics}/>;}
const customised=await renderBuilderSubpage(slug,"gallery",{onlyIfCustomised:true});if(customised)return customised;const s=await prisma.store.findUnique({where:{slug},select:{businessType:true,template:{select:{name:true}}}});if(isHotelStore({storeBusinessType:s?.businessType,templateName:s?.template?.name})){const raw=await prisma.store.findUniqueOrThrow({where:{slug},select:{id:true,slug:true,name:true,logoUrl:true,bannerUrl:true,storyImage:true,contactPhone:true,contactEmail:true,socialLinks:true,business:{select:{description:true,city:true,state:true,phone:true,email:true}}}});const hotelStore={...raw,address:[raw.business?.city,raw.business?.state].filter(Boolean).join(", ")||null,phone:raw.contactPhone??raw.business?.phone??null,email:raw.contactEmail??raw.business?.email??null};return <ThelusoHotel store={hotelStore} slug={slug} content={await getHotelContent(slug)}/>;}const [data,gallery]=await Promise.all([getGrandeurRestaurantData(slug),getGrandeurGallery(slug)]);if(!data)notFound();return <GrandeurGallery store={data.store} slug={slug} items={data.items} content={gallery}/>;}