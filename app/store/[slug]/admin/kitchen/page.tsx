import { getCanonicalBusinessType } from "@/lib/business-identity";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getKitchenDashboard } from "@/lib/actions/fnb";
import { KitchenWorkspace } from "@/components/dashboard/kitchen-workspace";

export default async function KitchenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, businessType: true, business: { select: { category: true } } },
  });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "kitchen-management");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  if (!["Restaurant", "Food & Groceries"].includes(getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType }))) notFound();
  const data = await getKitchenDashboard(slug);
  if (!data) notFound();
  return <KitchenWorkspace slug={slug} data={data} />;
}
