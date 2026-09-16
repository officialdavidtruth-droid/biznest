import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getHrDashboard } from "@/lib/actions/hr-payroll";
import { HrPayrollWorkspace } from "@/components/dashboard/hr-payroll-workspace"; import { auth } from "@/lib/auth"; import { assertStorePermission } from "@/lib/access/assert-store-access";

export default async function HrPayrollPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const session=await auth(); if(!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/apps/hr-payroll`);
 const access=await assertStorePermission(slug,"hr"); if(!access.success) redirect(`/store/${slug}/admin/apps`);
 const store=await prisma.store.findUnique({where:{slug},select:{id:true}}); if(!store)notFound();
 const e=await getPluginEntitlement(store.id,"hr-payroll"); if(!e.allowed||!e.installed)redirect(`/store/${slug}/admin/apps`);
 const data=await getHrDashboard(slug); if("error" in data)redirect(`/store/${slug}/admin/apps`);
 return <HrPayrollWorkspace slug={slug} data={data}/>;
}
