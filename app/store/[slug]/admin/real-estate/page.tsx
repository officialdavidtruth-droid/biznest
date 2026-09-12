import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { VerticalWorkspace } from "@/components/dashboard/vertical-workspace";
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const s=await auth();if(!s?.user?.id)redirect(`/login?callbackUrl=/${slug}/admin/real-estate`);const store=await prisma.store.findUnique({where:{slug},select:{id:true,name:true,businessType:true}});if(!store)notFound();const items=await prisma.realEstateProperty.findMany({where:{storeId:store.id},orderBy:{createdAt:"desc"},take:50});return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Real Estate Workspace</h1><p className="mt-1 text-sm text-muted-foreground">Industry-specific operations connected to Biznest core records.</p></div><VerticalWorkspace slug={slug} type="realestate" initial={JSON.parse(JSON.stringify(items))}/></div>}
