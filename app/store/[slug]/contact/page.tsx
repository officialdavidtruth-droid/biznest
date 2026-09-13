import { prisma } from "@/lib/prisma";
import { GrandeurContact } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";
export default async function ContactPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const s=await prisma.store.findUnique({where:{slug},select:{businessType:true,template:{select:{name:true}}}});if(String(s?.businessType||'').toLowerCase().includes('hotel')||String(s?.template?.name||'').includes('THELUSO'))return <ThelusoHotel store={await prisma.store.findUniqueOrThrow({where:{slug},select:{id:true,name:true,logoUrl:true,bannerUrl:true,storyImage:true,address:true,phone:true,email:true}})} slug={slug} content={await getHotelContent(slug)}/>;const data=await getGrandeurRestaurantData(slug);if(data)return <GrandeurContact store={data.store} slug={slug} items={data.items}/>;return renderUniversalSectionPage(slug,"contact");}
