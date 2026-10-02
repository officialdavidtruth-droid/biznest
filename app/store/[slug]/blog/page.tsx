import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ThelusoHotel } from "@/components/storefront/theluso-hotel";
import { getHotelContent } from "@/lib/hotel-content";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function BlogPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const store=await prisma.store.findUnique({where:{slug},select:{id:true,status:true,name:true,logoUrl:true,bannerUrl:true,template:{select:{name:true}},business:{select:{category:true}}}});
  if(!store || store.status!=="ACTIVE") notFound();
  if(store.template?.name==="Veloura — Superior Luxury Hotel"){const raw=await prisma.store.findUniqueOrThrow({where:{slug},select:{id:true,slug:true,name:true,logoUrl:true,bannerUrl:true,storyImage:true,contactPhone:true,contactEmail:true,business:{select:{city:true,state:true,phone:true,email:true}}}});const hotelStore={...raw,address:[raw.business?.city,raw.business?.state].filter(Boolean).join(", ")||null,phone:raw.contactPhone??raw.business?.phone??null,email:raw.contactEmail??raw.business?.email??null};return <ThelusoHotel store={hotelStore} slug={slug} content={await getHotelContent(slug)}/>;}
  return renderUniversalSectionPage(slug,"blog");
}
