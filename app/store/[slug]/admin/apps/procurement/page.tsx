import { Truck } from "lucide-react";
import { getPluginWorkspace } from "@/lib/actions/plugin-workspaces";
import { ProcurementWorkspace, type ProcurementData } from "@/components/dashboard/procurement-workspace";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";

export default async function ProcurementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPluginWorkspace(slug, "procurement");
  if ("error" in data) return <PluginInstallGate slug={slug} title="Procurement" message={data.error} icon={Truck} />;
  return <ProcurementWorkspace slug={slug} data={{ ...(data.special as Omit<ProcurementData, "plugin">), plugin: data.plugin }} />;
}
