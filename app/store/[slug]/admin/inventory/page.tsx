// Route: /store/[slug]/admin/inventory
import { getInventoryOverview, getInventoryProfitSummary, getInventoryReconciliation, getInventoryReorderSuggestions } from "@/lib/actions/inventory";
import { InventoryProfitSummary } from "@/components/dashboard/inventory-profit-summary";
import { InventoryTable } from "@/components/dashboard/inventory-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Boxes, CircleAlert, XCircle } from "lucide-react";
import { InventoryReconciliationCard } from "@/components/dashboard/inventory-reconciliation-card";

export default async function InventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [items, summary, reconciliation, reorderSuggestions] = await Promise.all([getInventoryOverview(slug), getInventoryProfitSummary(slug), getInventoryReconciliation(slug), getInventoryReorderSuggestions(slug)]);
  const currency = items[0]?.currency ?? "NGN";

  const lowStockCount = items.filter((i) => i.status === "LOW_STOCK").length;
  const outOfStockCount = items.filter((i) => i.status === "OUT_OF_STOCK").length;

  return (
    <div className="bn-admin-page space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track stock levels, cost and profit across your catalog</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Boxes} tone="purple" label="Tracked Items" value={items.length} note="Products with inventory tracking" />
        <StatCard icon={CircleAlert} tone="orange" label="Low Stock" value={lowStockCount} note="Below threshold" />
        <StatCard icon={XCircle} tone="red" label="Out of Stock" value={outOfStockCount} note="Currently unavailable" />
      </div>

      {items.length > 0 && <InventoryProfitSummary summary={summary} currency={currency} />}

      <InventoryReconciliationCard slug={slug} rows={reconciliation} />

      {reorderSuggestions.length > 0 && <section className="rounded-xl border bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-base font-bold">Reorder queue</h2><p className="mt-1 text-xs text-muted-foreground">Items at or below their configured threshold, with a suggested replenishment quantity.</p></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{reorderSuggestions.slice(0,6).map((r) => <div key={r.inventoryItemId} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{r.productName}</p><p className="mt-1 text-xs text-muted-foreground">On hand {r.quantity} · threshold {r.threshold}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">Reorder</span></div><p className="mt-3 text-xs font-semibold">Suggested: +{r.suggestedQuantity} units</p>{r.estimatedSpend != null && <p className="mt-1 text-[10px] text-muted-foreground">Estimated spend: ₦{r.estimatedSpend.toLocaleString()}</p>}</div>)}</div></section>}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4"><h2 className="text-base font-bold">Inventory</h2><p className="mt-1 text-xs text-muted-foreground">Search, filter and manage stock</p></div>
        <InventoryTable storeSlug={slug} items={items} />
      </section>
    </div>
  );
}
