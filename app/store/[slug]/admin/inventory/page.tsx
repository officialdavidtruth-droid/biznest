import { getInventoryOverview, getInventoryProfitSummary } from "@/lib/actions/inventory";
import { InventoryProfitSummary } from "@/components/dashboard/inventory-profit-summary";
import { InventoryRow } from "@/components/dashboard/inventory-row";

export default async function InventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [items, summary] = await Promise.all([getInventoryOverview(slug), getInventoryProfitSummary(slug)]);
  const currency = items[0]?.currency ?? "NGN";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <span className="text-xs text-muted-foreground">{items.length} tracked items</span>
      </div>

      {items.length > 0 && <InventoryProfitSummary summary={summary} currency={currency} />}

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Cost</th>
              <th className="px-4 py-2">Sell</th>
              <th className="px-4 py-2">Profit / unit</th>
              <th className="px-4 py-2">Margin</th>
              <th className="px-4 py-2">In stock</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <InventoryRow key={item.inventoryItemId} storeSlug={slug} item={item} />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  Nothing tracked yet. Physical products get an inventory row automatically once added.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
