// Route: /store/[slug]/admin/inventory
import { getInventoryOverview, getInventoryProfitSummary, getInventoryReconciliation, getInventoryReorderSuggestions } from "@/lib/actions/inventory";
import { InventoryTable } from "@/components/dashboard/inventory-table";
import { InventoryOverview } from "@/components/dashboard/inventory-overview";
import { InventoryReorderQueue } from "@/components/dashboard/inventory-reorder-queue";

export default async function InventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [items, summary, reconciliation, reorderSuggestions] = await Promise.all([getInventoryOverview(slug), getInventoryProfitSummary(slug), getInventoryReconciliation(slug), getInventoryReorderSuggestions(slug)]);
  const currency = items[0]?.currency ?? "NGN";
  const low = items.filter((i) => i.status === "LOW_STOCK").length;
  const out = items.filter((i) => i.status === "OUT_OF_STOCK").length;

  return (
    <div className="bn-admin-page space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Know what&apos;s in stock, what&apos;s running low, and what it&apos;s worth.</p>
      </div>

      <InventoryOverview slug={slug} total={items.length} low={low} out={out} summary={summary} currency={currency} rows={reconciliation} />

      <InventoryReorderQueue suggestions={reorderSuggestions} />

      <InventoryTable storeSlug={slug} items={items} />
    </div>
  );
}
