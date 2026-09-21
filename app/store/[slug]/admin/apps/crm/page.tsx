import { Users, Workflow, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getCrmDashboard } from "@/lib/actions/seo-crm";
import { CrmTabs } from "@/components/dashboard/crm-tabs";
import { CrmWorkspace } from "@/components/dashboard/crm-workspace";
import type { Lead } from "@/components/dashboard/crm-types";
import { getPluginEntitlement } from "@/lib/plugins";
import { assertStorePermission } from "@/lib/access/assert-store-access";

export default async function CRMPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await assertStorePermission(slug, "customers");
  if (!access.success) return null;
  const entitlement = await getPluginEntitlement(access.store.id, "crm");
  if (!entitlement.allowed || !entitlement.installed) {
    return (
      <div className="rounded-3xl border bg-background p-10 text-center">
        <Users className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-xl font-bold">BizNest CRM</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Install the CRM app to manage leads, opportunities and customer relationships from one workspace.</p>
        <Link href={`/store/${slug}/admin/apps`} className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Apps</Link>
      </div>
    );
  }
  const result = await getCrmDashboard(slug);
  if (!result.success) return null;
  const d = result.data;

  return (
    <div className="space-y-6">
      <CrmTabs slug={slug} active="pipeline" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales pipeline</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Track every lead from first contact to closed deal. Drag a card between stages, or open it to log calls, set follow-ups and keep notes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/store/${slug}/admin/customers`} className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-xs font-semibold hover:border-primary/50"><Users className="h-4 w-4" />Customer 360<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /></Link>
          <Link href={`/store/${slug}/admin/automations`} className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-xs font-semibold hover:border-primary/50"><Workflow className="h-4 w-4" />Automations<ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /></Link>
        </div>
      </div>
      <CrmWorkspace slug={slug} initial={{ leads: d.leads as unknown as Lead[], customerCount: d.customerCount, wonCount: d.wonCount, wonValue: d.wonValue }} />
    </div>
  );
}
