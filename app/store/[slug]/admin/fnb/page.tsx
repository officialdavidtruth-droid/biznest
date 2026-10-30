import { getCanonicalBusinessType } from "@/lib/business-identity";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getFnbDashboard } from "@/lib/actions/fnb";
import { FnbWorkspace } from "@/components/dashboard/fnb-workspace";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants/commission";

export default async function FnbPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, businessType: true, business: { select: { category: true } } },
  });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "fnb-operations");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);
  if (!["Restaurant", "Food & Groceries"].includes(getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType }))) notFound();
  const data = await getFnbDashboard(slug);
  if (!data) notFound();
  return <FnbWorkspace slug={slug} data={{ ...data, posCommissionRatePercent: PLATFORM_COMMISSION_PERCENT }} />;
}
