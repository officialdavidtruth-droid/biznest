import { notFound } from "next/navigation";
import { getGrandeurAdminContent } from "@/lib/actions/grandeur-content";
import { GrandeurContentManager } from "@/components/dashboard/grandeur-content-manager";
import { prisma } from "@/lib/prisma";
export default async function GrandeurEventsAdmin({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const store=await prisma.store.findUnique({where:{slug},select:{businessType:true}});if(!store||store.businessType!=="Restaurant")notFound();const initial=await getGrandeurAdminContent(slug);return <GrandeurContentManager slug={slug} initial={initial}/>;}
