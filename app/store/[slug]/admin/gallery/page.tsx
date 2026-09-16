import { notFound } from "next/navigation";
import { getGrandeurAdminContent } from "@/lib/actions/grandeur-content";
import { GrandeurContentManager } from "@/components/dashboard/grandeur-content-manager";
import { prisma } from "@/lib/prisma"; import { auth } from "@/lib/auth"; import { assertStorePermission } from "@/lib/access/assert-store-access"; import { isRestaurantBusiness } from "@/lib/business-identity";
export default async function GrandeurGalleryAdmin({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const session=await auth();if(!session?.user?.id)notFound();const access=await assertStorePermission(slug,"settings");if(!access.success)notFound();const store=await prisma.store.findUnique({where:{slug},select:{businessType:true}});if(!store||!isRestaurantBusiness(store.businessType))notFound();const initial=await getGrandeurAdminContent(slug);return <GrandeurContentManager slug={slug} initial={initial}/>;}
