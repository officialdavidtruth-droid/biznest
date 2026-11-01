import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { getTravelDashboard } from "@/lib/actions/travel";
import { TravelWorkspace } from "@/components/dashboard/travel-workspace";
import { TRAVEL_BUSINESS_TYPE, TRAVEL_PLUGIN_KEY } from "@/lib/travel";

export default async function TravelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, businessType: true, business: { select: { category: true } } } });
  if (!store) notFound();
  const type = getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType });
  if (type !== TRAVEL_BUSINESS_TYPE) notFound();
  const entitlement = await getPluginEntitlement(store.id, TRAVEL_PLUGIN_KEY);
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  const data = await getTravelDashboard(slug);
  if (!data) notFound();
  return <TravelWorkspace slug={slug} data={data} />;
}
