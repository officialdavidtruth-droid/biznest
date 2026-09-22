import { Calculator } from "lucide-react";
import { getFinancialControlData } from "@/lib/actions/financial-control";
import { FinancialControlWorkspace } from "@/components/dashboard/financial-control-workspace";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";

export default async function FinancialControlPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getFinancialControlData(slug);
  if ("error" in data) return <PluginInstallGate slug={slug} title="Financial Control" message={data.error} icon={Calculator} />;
  return <FinancialControlWorkspace data={data} />;
}
