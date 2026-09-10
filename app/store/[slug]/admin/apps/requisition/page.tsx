import { redirect } from "next/navigation";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { RequisitionWorkspace } from "@/components/dashboard/requisition-workspace";
import { getRequisitionSummary, listRequisitions } from "@/lib/actions/requisition";

export default async function RequisitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) redirect(`/store/${slug}/admin/apps`);
  const entitlement = await getPluginEntitlement(store.id, "requisition");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  const [rows, summary] = await Promise.all([listRequisitions(slug), getRequisitionSummary(slug)]);
  return <RequisitionWorkspace slug={slug} rows={rows} summary={summary} />;
}
