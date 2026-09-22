import { redirect, notFound } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getHrDashboard } from "@/lib/actions/hr-payroll";
import { HrPayrollWorkspace } from "@/components/dashboard/hr-payroll-workspace";
import { auth } from "@/lib/auth";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";

export default async function HrPayrollPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Signed-out visitors have nowhere to render an inline message to — this is a real
  // navigation redirect (to sign-in), not the "app not installed" case below.
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/apps/hr-payroll`);
  const access = await assertStorePermission(slug, "hr");
  if (!access.success) return <PluginInstallGate slug={slug} title="HR & Payroll" message={access.error} icon={BriefcaseBusiness} />;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "hr-payroll");
  if (!entitlement.allowed || !entitlement.installed) return <PluginInstallGate slug={slug} title="HR & Payroll" message={entitlement.reason} icon={BriefcaseBusiness} />;
  const data = await getHrDashboard(slug);
  if ("error" in data) return <PluginInstallGate slug={slug} title="HR & Payroll" message={data.error} icon={BriefcaseBusiness} />;
  return <HrPayrollWorkspace slug={slug} data={data} />;
}
