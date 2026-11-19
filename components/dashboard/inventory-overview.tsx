import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info } from "lucide-react";
import type { getInventoryProfitSummary, InventoryReconciliationRow } from "@/lib/actions/inventory";
import { formatNumber } from "@/lib/i18n/locale";

type Summary = Awaited<ReturnType<typeof getInventoryProfitSummary>>;

/**
 * One calm overview card instead of a wall of equal boxes: a stock-health bar,
 * the three money figures as a divided strip (a list on phones), and a slim
 * ledger-audit line that only grows when something needs review.
 */
export function InventoryOverview({
  slug,
  total,
  low,
  out,
  summary,
  currency,
  rows,
}: {
  slug: string;
  total: number;
  low: number;
  out: number;
  summary: Summary;
  currency: string;
  rows: InventoryReconciliationRow[];
}) {
  const inStock = Math.max(0, total - low - out);
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  const discrepancies = rows.filter((r) => r.status === "DISCREPANCY");
  const corrupt = rows.filter((r) => r.status === "LEDGER_CORRUPT");
  const noLedger = rows.filter((r) => r.status === "NO_LEDGER");
  const verified = rows.filter((r) => r.status === "OK").length;
  const flagged = [...corrupt, ...discrepancies];

  const money = [
    { label: "Stock value", hint: "at cost", value: `${currency} ${formatNumber(summary.totalCostValue)}` },
    {
      label: "Potential profit",
      hint: summary.trackedTotal > 0 ? `${summary.trackedWithCost} of ${summary.trackedTotal} items have a cost` : "no items yet",
      value: `${currency} ${formatNumber(summary.totalPotentialProfit)}`,
      accent: true,
    },
    { label: "Blended margin", hint: "across priced items", value: summary.blendedMargin != null ? `${summary.blendedMargin}%` : "—" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="p-4 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Stock health</h2>
          <p className="text-xs text-muted-foreground">{total} tracked {total === 1 ? "item" : "items"}</p>
        </div>

        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100" role="img" aria-label={`${inStock} in stock, ${low} low, ${out} out of stock`}>
          {total > 0 && (
            <>
              <span className="bg-emerald-600" style={{ width: `${pct(inStock)}%` }} />
              <span className="bg-amber-400" style={{ width: `${pct(low)}%` }} />
              <span className="bg-red-500" style={{ width: `${pct(out)}%` }} />
            </>
          )}
        </div>

        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-600">
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> <b className="font-semibold text-gray-900">{inStock}</b> healthy</li>
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> <b className="font-semibold text-gray-900">{low}</b> running low</li>
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> <b className="font-semibold text-gray-900">{out}</b> sold out</li>
        </ul>
      </div>

      <dl className="grid divide-y border-t bg-gray-50/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {money.map((m) => (
          <div key={m.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:block sm:px-6 sm:py-4">
            <div>
              <dt className="text-xs font-medium text-gray-500">{m.label}</dt>
              <p className="mt-0.5 hidden text-[11px] text-gray-400 sm:block">{m.hint}</p>
            </div>
            <dd className={`text-sm font-semibold tabular-nums sm:mt-1 sm:text-base ${m.accent ? "text-[#0f6410]" : "text-gray-900"}`}>{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className={`flex min-w-0 items-center gap-2 text-xs ${flagged.length ? "font-medium text-amber-800" : "text-gray-600"}`}>
            {flagged.length ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
            <span className="truncate sm:whitespace-normal">
              {flagged.length
                ? `${flagged.length} ${flagged.length === 1 ? "item needs" : "items need"} a stock check`
                : rows.length > 0
                  ? `Stock history checked — ${verified} of ${rows.length} match`
                  : "Stock history check will appear once items are tracked"}
            </span>
          </p>
          <Link href={`/store/${slug}/admin/inventory`} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#0f6410] hover:underline">
            <ClipboardCheck className="h-3.5 w-3.5" /> Recheck
          </Link>
        </div>

        {flagged.length > 0 && (
          <ul className="mt-3 space-y-2">
            {flagged.slice(0, 8).map((row) => (
              <li key={`${row.stockType}-${row.stockId}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                <span className="font-semibold text-gray-900">{row.productName}{row.variantLabel ? ` — ${row.variantLabel}` : ""}</span>
                <span className="block text-gray-600 sm:inline"> {row.status === "LEDGER_CORRUPT" ? "· history sequence is inconsistent" : `· shows ${row.storedQuantity}, history says ${row.ledgerQuantity}`}</span>
              </li>
            ))}
            {flagged.length > 8 && <li className="text-xs text-muted-foreground">Showing the first 8.</li>}
          </ul>
        )}

        {noLedger.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-gray-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {noLedger.length} {noLedger.length === 1 ? "item has" : "items have"} no movement history yet, so its opening stock can&apos;t be verified.
          </p>
        )}
      </div>
    </section>
  );
}
