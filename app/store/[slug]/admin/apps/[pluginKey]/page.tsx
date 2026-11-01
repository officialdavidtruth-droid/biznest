import { notFound, redirect } from "next/navigation";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { getPluginWorkspace } from "@/lib/actions/plugin-workspaces";
import { PluginWorkspace } from "@/components/dashboard/plugin-workspace";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";
import FinancialControlPage from "../financial-control/page";
import RequisitionPage from "../requisition/page";
import HrPayrollPage from "../hr-payroll/page";
import QrCodesPage from "../qr-codes/page";
import CouponsGiftCardsPage from "../coupons-gift-cards/page";
import { supportsAbandonedCheckout } from "@/lib/business-identity";
import { AdvancedAnalyticsWorkspace } from "@/components/dashboard/advanced-analytics-workspace";
import { getAdvancedAnalytics } from "@/lib/actions/analytics-report";
import { moneyFormatter } from "@/lib/utils/format-money";
import { LegalComplianceWorkspace } from "@/components/dashboard/legal-compliance-workspace";
import { getLegalWorkspace } from "@/lib/actions/legal-compliance";
import { HelpdeskWorkspace } from "@/components/dashboard/helpdesk-workspace";
import { getHelpdeskWorkspace } from "@/lib/actions/helpdesk";
import { AssetManagementWorkspace } from "@/components/dashboard/asset-management-workspace";
import { getAssetWorkspace } from "@/lib/actions/asset-management";
import { ProcurementWorkspace, type ProcurementData } from "@/components/dashboard/procurement-workspace";

// PMS and FNB are full dedicated workspaces (/admin/pms, /admin/fnb), not the generic
// catalog-style plugin page below, so they redirect there once installed. Every other
// plugin renders its workspace inline here — including showing an inline "install this
// app" message when it isn't installed yet, rather than bouncing the visitor away.
const DEDICATED_ROUTE: Record<string, string> = { pms: "/admin/pms", "fnb-operations": "/admin/fnb" };

export default async function PluginPage({ params, searchParams }: { params: Promise<{ slug: string; pluginKey: string }>; searchParams: Promise<{ range?: string }> }) {
  const { slug, pluginKey } = await params;
  const { range } = await searchParams;
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
  if (pluginKey === "coupons-gift-cards") return <CouponsGiftCardsPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "qr-codes") return <QrCodesPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "hr-payroll") return <HrPayrollPage params={Promise.resolve({ slug })} />;
  if (pluginKey === "advanced-analytics") {
    const rangeDays = ["7", "30", "90"].includes(range ?? "") ? Number(range) : 30;
    const fullStore = await prisma.store.findUnique({ where: { id: store.id }, include: { business: true } });
    if (!fullStore) notFound();
    try {
      const data = await getAdvancedAnalytics(store.id, rangeDays);
      return <AdvancedAnalyticsWorkspace slug={slug} rangeDays={rangeDays} data={data} money={moneyFormatter(fullStore)} showAbandoned={supportsAbandonedCheckout(fullStore.business.category, fullStore.business)} />;
    } catch (e) {
      return <PluginInstallGate slug={slug} title="Advanced Analytics" message={e instanceof Error ? e.message : "Analytics could not be loaded."} />;
    }
  }
  if (pluginKey === "legal-compliance") {
    const data = await getLegalWorkspace(slug);
    if ("error" in data) return <PluginInstallGate slug={slug} title="Legal & Compliance" message={data.error} />;
    return <LegalComplianceWorkspace slug={slug} data={data} />;
  }
  if (pluginKey === "helpdesk") {
    const data = await getHelpdeskWorkspace(slug);
    if ("error" in data) return <PluginInstallGate slug={slug} title="Customer Support" message={data.error} />;
    return <HelpdeskWorkspace slug={slug} data={data} />;
  }
  if (pluginKey === "asset-management") {
    const data = await getAssetWorkspace(slug);
    if ("error" in data) return <PluginInstallGate slug={slug} title="Asset Management" message={data.error} />;
    return <AssetManagementWorkspace slug={slug} data={data} />;
  }
  if (pluginKey === "procurement") {
    const data = await getPluginWorkspace(slug, pluginKey);
    if ("error" in data) return <PluginInstallGate slug={slug} title="Procurement" message={data.error} />;
    return <ProcurementWorkspace slug={slug} data={{ ...(data.special as Omit<ProcurementData, "plugin">), plugin: data.plugin }} />;
  }
  const data = await getPluginWorkspace(slug, pluginKey);
  if ("error" in data) return <PluginInstallGate slug={slug} title={pluginKey} message={data.error} />;
  return <PluginWorkspace slug={slug} data={data} />;
}
