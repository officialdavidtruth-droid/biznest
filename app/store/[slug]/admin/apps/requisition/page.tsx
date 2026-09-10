import { RequisitionWorkspace } from "@/components/dashboard/requisition-workspace";
import { getRequisitionSummary, listRequisitions } from "@/lib/actions/requisition";

export default async function RequisitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [rows, summary] = await Promise.all([listRequisitions(slug), getRequisitionSummary(slug)]);
  return <RequisitionWorkspace slug={slug} rows={rows} summary={summary} />;
}
