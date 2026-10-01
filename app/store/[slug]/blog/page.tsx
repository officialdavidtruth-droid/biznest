import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GrandVereBlog } from "@/components/storefront/signature-screenshot-home";
import { renderUniversalSectionPage } from "@/components/storefront/universal-section-page-route";

export default async function BlogPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const store=await prisma.store.findUnique({where:{slug},select:{id:true,status:true,name:true,logoUrl:true,bannerUrl:true,template:{select:{name:true}},business:{select:{category:true}}}});
  if(!store || store.status!=="ACTIVE") notFound();
  if(store.template?.name==="Veloura — Superior Luxury Hotel") return <GrandVereBlog store={store} slug={slug}/>;
  return renderUniversalSectionPage(slug,"about");
}
