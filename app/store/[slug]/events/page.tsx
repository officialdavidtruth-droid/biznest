import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { GrandeurEvents } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { getGrandeurEvents } from "@/lib/grandeur-content";
export default async function EventsPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const s=await prisma.store.findUnique({where:{slug},select:{businessType:true,template:{select:{name:true}}}});if(String(s?.businessType||'').toLowerCase().includes('hotel')||String(s?.template?.name||'').includes('THELUSO'))return <ThelusoHotel store={await prisma.store.findUniqueOrThrow({where:{slug},select:{id:true,name:true,logoUrl:true,bannerUrl:true,storyImage:true,address:true,phone:true,email:true}})} slug={slug} content={await getHotelContent(slug)}/>;const [data,events]=await Promise.all([getGrandeurRestaurantData(slug),getGrandeurEvents(slug)]);if(!data)notFound();return <GrandeurEvents store={data.store} slug={slug} items={data.items} content={events}/>;}
