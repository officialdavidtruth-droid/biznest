import { notFound, redirect } from "next/navigation";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { getPluginWorkspace } from "@/lib/actions/plugin-workspaces";
import { PluginWorkspace } from "@/components/dashboard/plugin-workspace";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";
import FinancialControlPage from "../financial-control/page";
import RequisitionPage from "../requisition/page";
import HrPayrollPage from "../hr-payroll/page";
import { ProcurementWorkspace, type ProcurementData } from "@/components/dashboard/procurement-workspace";

// PMS and FNB are full dedicated workspaces (/admin/pms, /admin/fnb), not the generic
// catalog-style plugin page below, so they redirect there once installed. Every other
// plugin renders its workspace inline here — including showing an inline "install this
// app" message when it isn't installed yet, rather than bouncing the visitor away.
const DEDICATED_ROUTE: Record<string, string> = { pms: "/pms", "fnb-operations": "/fnb" };

export default async function PluginPage({ params }: { params: Promise<{ slug: string; pluginKey: string }> }) {
  const { slug, pluginKey } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, pluginKey);
  if (!entitlement.allowed || !entitlement.installed) {
    const dedicated = DEDICATED_ROUTE[pluginKey];
    if (dedicated) redirect(`/store/${slug}/admin/apps`);
    return <PluginInstallGate slug={slug} title={pluginKey} message={entitlement.reason} />;
  }
  const dedicated = DEDICATED_ROUTE[pluginKey];
  if (dedicated) redirect(`/store/${slug}${dedicated}`);
  if (pluginKey === "financial-control") return <FinancialControlPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "requisition") return <RequisitionPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "hr-payroll") return <HrPayrollPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "procurement") {
    const data = await getPluginWorkspace(slug, pluginKey);
    if ("error" in data) return <PluginInstallGate slug={slug} title="Procurement" message={data.error} />;
    return <ProcurementWorkspace slug={slug} data={{ ...(data.special as Omit<ProcurementData, "plugin">), plugin: data.plugin }} />;
  }
  const data = await getPluginWorkspace(slug, pluginKey);
  if ("error" in data) return <PluginInstallGate slug={slug} title={pluginKey} message={data.error} />;
  return <PluginWorkspace slug={slug} data={data} />;
}
