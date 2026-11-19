import { RefreshCcw } from "lucide-react";
import type { getInventoryReorderSuggestions } from "@/lib/actions/inventory";
import { formatMoney } from "@/lib/utils/format-money";

type Suggestion = Awaited<ReturnType<typeof getInventoryReorderSuggestions>>[number];

/** Items at or under their alert level. Swipes sideways on phones, grid on desktop. */
export function InventoryReorderQueue({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <RefreshCcw className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-gray-900">Restock soon</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{suggestions.length}</span>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
        {suggestions.slice(0, 6).map((r) => {
          const fill = r.threshold > 0 ? Math.min(100, Math.round((r.quantity / r.threshold) * 100)) : 0;
          return (
            <div key={r.inventoryItemId} className="w-[78%] shrink-0 snap-start rounded-xl border bg-background p-4 shadow-sm sm:w-auto">
              <p className="truncate text-sm font-semibold text-gray-900">{r.productName}{r.variantLabel ? ` — ${r.variantLabel}` : ""}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span className={`block h-full rounded-full ${r.quantity <= 0 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${Math.max(fill, r.quantity > 0 ? 6 : 0)}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">{r.quantity} left · alert at {r.threshold}</p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs">
                <span className="font-semibold text-[#0f6410]">Order about {r.suggestedQuantity} more</span>
                {r.estimatedSpend != null && <span className="text-gray-500">≈ {formatMoney(r.estimatedSpend)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
