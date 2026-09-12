import { Users, Sparkles, Workflow, Mail, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCrmDashboard } from "@/lib/actions/seo-crm";
import { CrmWorkspace } from "@/components/dashboard/crm-workspace";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";

export default async function CRMPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const access=await assertStorePermission(slug,"customers"); if(!access.success)return null;
 const entitlement=await getPluginEntitlement(access.store.id,"crm");
 if(!entitlement.allowed||!entitlement.installed)return <div className="rounded-3xl border bg-background p-10 text-center"><Users className="mx-auto h-10 w-10 text-primary"/><h1 className="mt-4 text-xl font-bold">BizNest CRM</h1><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Install the CRM app to manage leads, opportunities and customer relationships from one workspace.</p><Link href={`/store/${slug}/admin/apps`} className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Apps</Link></div>;
 const result=await getCrmDashboard(slug); if(!result.success)return null;
 const d=result.data;
 return <div className="space-y-7">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Sparkles className="h-3.5 w-3.5"/>BizNest App</div><h1 className="mt-1 text-3xl font-bold tracking-tight">CRM & Sales</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Turn inquiries into customers with a visual pipeline, customer 360 and follow-up workflow.</p></div><div className="flex gap-2"><Link href={`/store/${slug}/admin/customers`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold"><Users className="h-4 w-4"/>Customer 360</Link><Link href={`/store/${slug}/admin/automations`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold"><Workflow className="h-4 w-4"/>Automations</Link><Link href={`/store/${slug}/admin/marketing`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Mail className="h-4 w-4"/>Marketing</Link></div></div>
  <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-background to-background p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Sales command center</p><p className="mt-1 text-sm font-medium">Capture a lead, follow up, send a quote and close the deal — without leaving BizNest.</p></div><ArrowUpRight className="h-5 w-5 text-primary"/></div></div>
  <CrmWorkspace slug={slug} initial={{leads:d.leads as any,customerCount:d.customerCount,wonCount:d.wonCount,wonValue:d.wonValue}}/>
 </div>;
}
