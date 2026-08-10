import { AlertTriangle, PackageX, TrendingUp } from "lucide-react";
import type { getInventoryProfitSummary } from "@/lib/actions/inventory";

export function InventoryProfitSummary({
  summary,
  currency,
}: {
  summary: Awaited<ReturnType<typeof getInventoryProfitSummary>>;
  currency: string;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs text-muted-foreground">Potential profit</p>
        <p className="mt-1 text-lg font-semibold text-green-700">
          {currency} {summary.totalPotentialProfit.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          across {summary.trackedWithCost} of {summary.trackedTotal} items with cost set
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs text-muted-foreground">Blended margin</p>
        <p className="mt-1 flex items-center gap-1 text-lg font-semibold">
          <TrendingUp className="h-4 w-4 text-green-600" />
          {summary.blendedMargin != null ? `${summary.blendedMargin}%` : "—"}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs text-muted-foreground">Stock on hand (cost value)</p>
        <p className="mt-1 text-lg font-semibold">
          {currency} {summary.totalCostValue.toLocaleString()}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-xs text-muted-foreground">Needs attention</p>
        <p className="mt-1 flex items-center gap-3 text-lg font-semibold">
          <span className="flex items-center gap-1 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            {summary.lowStockCount}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <PackageX className="h-4 w-4" />
            {summary.outOfStockCount}
          </span>
        </p>
      </div>
    </div>
  );
}
