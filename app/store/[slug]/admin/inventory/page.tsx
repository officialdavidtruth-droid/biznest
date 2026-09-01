// Route: /store/[slug]/admin/inventory
import { getInventoryOverview, getInventoryProfitSummary } from "@/lib/actions/inventory";
import { InventoryProfitSummary } from "@/components/dashboard/inventory-profit-summary";
import { InventoryTable } from "@/components/dashboard/inventory-table";
import { StatCard } from "@/components/dashboard/list-toolbar";
import { Boxes, CircleAlert, XCircle } from "lucide-react";

export default async function InventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [items, summary] = await Promise.all([getInventoryOverview(slug), getInventoryProfitSummary(slug)]);
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

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4"><h2 className="text-base font-bold">Inventory</h2><p className="mt-1 text-xs text-muted-foreground">Search, filter and manage stock</p></div>
        <InventoryTable storeSlug={slug} items={items} />
      </section>
    </div>
  );
}
