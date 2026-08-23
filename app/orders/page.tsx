import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LegacyOrdersPage(){ const session=await auth(); if(!session?.user?.id) redirect("/login"); const membership=await prisma.storeCustomer.findFirst({where:{userId:session.user.id},select:{store:{select:{slug:true}}}}); if(membership) redirect(`/store/${membership.store.slug}/account/orders`); return null; }
