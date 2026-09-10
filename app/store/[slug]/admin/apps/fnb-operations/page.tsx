import { redirect } from "next/navigation";
import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { getFnbDashboard } from "@/lib/actions/fnb";
import { FnbWorkspace } from "@/components/dashboard/fnb-workspace";

export default async function FnbOperationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) redirect(`/store/${slug}/admin/apps`);
  const entitlement = await getPluginEntitlement(store.id, "fnb-operations");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  const data = await getFnbDashboard(slug);
  if (!data) redirect(`/store/${slug}/admin/apps`);
  return <FnbWorkspace slug={slug} data={data} />;
}
