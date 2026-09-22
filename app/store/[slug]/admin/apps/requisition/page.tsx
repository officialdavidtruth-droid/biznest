import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { RequisitionWorkspace } from "@/components/dashboard/requisition-workspace";
import { getRequisitionSummary, listRequisitions } from "@/lib/actions/requisition";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";

export default async function RequisitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "requisition");
  if (!entitlement.allowed || !entitlement.installed) return <PluginInstallGate slug={slug} title="Requisitions" message={entitlement.reason} icon={ClipboardList} />;
  const [rows, summary] = await Promise.all([listRequisitions(slug), getRequisitionSummary(slug)]);
  return <RequisitionWorkspace slug={slug} rows={rows} summary={summary} />;
}
