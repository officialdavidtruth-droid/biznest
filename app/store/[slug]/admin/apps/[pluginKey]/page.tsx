import { notFound, redirect } from "next/navigation";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { getPluginWorkspace } from "@/lib/actions/plugin-workspaces";
import { PluginWorkspace } from "@/components/dashboard/plugin-workspace";
import FinancialControlPage from "../financial-control/page";
import RequisitionPage from "../requisition/page";
import FnbOperationsPage from "../fnb-operations/page";
import HrPayrollPage from "../hr-payroll/page";
import { ProcurementWorkspace, type ProcurementData } from "@/components/dashboard/procurement-workspace";

export default async function PluginPage({ params }: { params: Promise<{ slug: string; pluginKey: string }> }) {
  const { slug, pluginKey } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, pluginKey);
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  if (pluginKey === "financial-control") return <FinancialControlPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "requisition") return <RequisitionPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "fnb-operations") return <FnbOperationsPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "hr-payroll") return <HrPayrollPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "procurement") {
    const data = await getPluginWorkspace(slug, pluginKey);
    if ("error" in data) redirect(`/store/${slug}/admin/apps`);
    return <ProcurementWorkspace slug={slug} data={data.special as ProcurementData} />;
  }
  const data = await getPluginWorkspace(slug, pluginKey);
  if ("error" in data) redirect(`/store/${slug}/admin/apps`);
  return <PluginWorkspace slug={slug} data={data} />;
}
