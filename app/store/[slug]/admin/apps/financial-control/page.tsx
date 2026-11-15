import { Calculator, ShieldCheck } from "lucide-react";
import { getFinancialControlData } from "@/lib/actions/financial-control";
import { FinancialControlWorkspace } from "@/components/dashboard/financial-control-workspace";
import { FinancialAudit } from "@/components/dashboard/financial-audit";
import { PluginInstallGate } from "@/components/dashboard/plugin-install-gate";
import { financialAccessLevel } from "@/lib/financial/access";

export default async function FinancialControlPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await financialAccessLevel(slug);

  // Staff granted only the audit permission get the audit workspace and nothing else.
  if (access.success && access.level === "audit") {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface)] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--bn-admin-orange)]" />
          <div><p className="text-sm font-bold">Auditor access</p><p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">You can run counts, record findings and sign off audits for {access.a.store.name}. Accounts, statements and postings stay with the finance team.</p></div>
        </div>
        <FinancialAudit slug={slug} currency={access.a.store.currency} auditorMode />
      </div>
    );
  }

  const data = await getFinancialControlData(slug);
  if ("error" in data) return <PluginInstallGate slug={slug} title="Financial Control" message={data.error} icon={Calculator} />;
  return <FinancialControlWorkspace data={data} />;
}
