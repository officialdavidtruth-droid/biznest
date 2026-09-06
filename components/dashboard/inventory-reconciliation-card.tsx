import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info } from "lucide-react";
import type { InventoryReconciliationRow } from "@/lib/actions/inventory";

export function InventoryReconciliationCard({ slug, rows }: { slug: string; rows: InventoryReconciliationRow[] }) {
  const discrepancies = rows.filter((r) => r.status === "DISCREPANCY");
  const corrupt = rows.filter((r) => r.status === "LEDGER_CORRUPT");
  const noLedger = rows.filter((r) => r.status === "NO_LEDGER");
  const checked = rows.filter((r) => r.status === "OK");
  const attention = discrepancies.length + corrupt.length;

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="rounded-lg bg-slate-100 p-2"><ClipboardCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-bold">Inventory ledger audit</h2>
            <p className="mt-1 text-xs text-muted-foreground">Compares stored stock with the append-only movement ledger. Nothing is changed automatically.</p>
          </div>
        </div>
        <Link href={`/store/${slug}/admin/inventory`} className="text-sm font-medium underline underline-offset-4">Refresh audit</Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Verified</p><p className="mt-1 text-lg font-bold">{checked.length}</p></div>
        <div className={`rounded-lg border p-3 ${attention ? "border-red-200 bg-red-50" : ""}`}><p className="text-xs text-muted-foreground">Needs review</p><p className="mt-1 text-lg font-bold">{attention}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">No ledger</p><p className="mt-1 text-lg font-bold">{noLedger.length}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Audited stocks</p><p className="mt-1 text-lg font-bold">{rows.length}</p></div>
      </div>

      {attention > 0 ? (
        <div className="mt-4 space-y-2">
          {[...corrupt, ...discrepancies].slice(0, 8).map((row) => (
            <div key={`${row.stockType}-${row.stockId}`} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><span className="font-semibold">{row.productName}{row.variantLabel ? ` — ${row.variantLabel}` : ""}</span><span className="text-muted-foreground"> · {row.status === "LEDGER_CORRUPT" ? "ledger sequence is inconsistent" : `stored ${row.storedQuantity}, ledger ${row.ledgerQuantity}`}</span></div>
            </div>
          ))}
          {attention > 8 && <p className="text-xs text-muted-foreground">Showing the first 8 items requiring review.</p>}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4" /> All recorded ledgers reconcile with their current stock quantities.
        </div>
      )}

      {noLedger.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {noLedger.length} stock item{noLedger.length === 1 ? " has" : "s have"} no movement history. Its opening balance cannot be independently verified until a ledger entry exists.
        </div>
      )}
    </section>
  );
}
