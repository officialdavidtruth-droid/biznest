import { redirect } from "next/navigation";
import { getFinancialControlData } from "@/lib/actions/financial-control";
import { FinancialControlWorkspace } from "@/components/dashboard/financial-control-workspace";

export default async function FinancialControlPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getFinancialControlData(slug);
  if ("error" in data) redirect(`/store/${slug}/admin/apps`);
  return <FinancialControlWorkspace data={data} />;
}
