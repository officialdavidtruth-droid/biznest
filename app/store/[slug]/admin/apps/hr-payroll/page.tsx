import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getHrDashboard } from "@/lib/actions/hr-payroll";
import { HrPayrollWorkspace } from "@/components/dashboard/hr-payroll-workspace";

export default async function HrPayrollPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const store=await prisma.store.findUnique({where:{slug},select:{id:true}}); if(!store)notFound();
 const e=await getPluginEntitlement(store.id,"hr-payroll"); if(!e.allowed||!e.installed)redirect(`/store/${slug}/admin/apps`);
 const data=await getHrDashboard(slug); if("error" in data)redirect(`/store/${slug}/admin/apps`);
 return <HrPayrollWorkspace slug={slug} data={data}/>;
}
