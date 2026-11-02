import { redirect, notFound } from "next/navigation";
import { UserSearch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { getRecruitmentDashboard } from "@/lib/actions/recruitment";
import { RecruitmentWorkspace } from "@/components/dashboard/recruitment-workspace";
import { auth } from "@/lib/auth";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";

export default async function RecruitmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/store/${slug}/admin/apps/recruitment-ats`);
  const access = await assertAnyStorePermission(slug, ["plugin:recruitment-ats"]);
  if (!access.success) return <PluginInstallGate slug={slug} title="Recruitment" message={access.error} icon={UserSearch} />;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "recruitment-ats");
  if (!entitlement.allowed || !entitlement.installed) return <PluginInstallGate slug={slug} title="Recruitment" message={entitlement.reason} icon={UserSearch} />;
  const data = await getRecruitmentDashboard(slug);
  if ("error" in data) return <PluginInstallGate slug={slug} title="Recruitment" message={data.error} icon={UserSearch} />;
  return <RecruitmentWorkspace slug={slug} data={data} />;
}
