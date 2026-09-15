import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getKitchenOpsDashboard } from "@/lib/actions/kitchen-ops";
import { KitchenOpsWorkspace } from "@/components/dashboard/kitchen-ops-workspace";

export default async function KitchenOpsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, businessType: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "restaurant-operations");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  if (!["Restaurant", "Food & Groceries"].includes(store.businessType)) notFound();
  const data = await getKitchenOpsDashboard(slug);
  if (!data) notFound();
  return <KitchenOpsWorkspace slug={slug} data={data} />;
}
