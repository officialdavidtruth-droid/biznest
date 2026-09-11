import { redirect } from "next/navigation";
import { getPluginWorkspace } from "@/lib/actions/plugin-workspaces";
import { ProcurementWorkspace, type ProcurementData } from "@/components/dashboard/procurement-workspace";

export default async function ProcurementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPluginWorkspace(slug, "procurement");
  if ("error" in data) redirect(`/store/${slug}/admin/apps`);
  return <ProcurementWorkspace slug={slug} data={data.special as ProcurementData} />;
}
