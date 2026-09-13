import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getHotelContent } from "@/lib/hotel-content";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
export default async function HotelPage({slug}:{slug:string}){const store=await prisma.store.findUnique({where:{slug},select:{id:true,name:true,logoUrl:true,bannerUrl:true,storyImage:true,address:true,phone:true,email:true,status:true,businessType:true,template:{select:{name:true,category:true}}}});if(!store||store.status!=="ACTIVE")notFound();if(!String(store.businessType||"").toLowerCase().includes("hotel")&&!String(store.template?.name||"").includes("THELUSO"))notFound();return <ThelusoHotel store={store} slug={slug} content={await getHotelContent(slug)}/>}
