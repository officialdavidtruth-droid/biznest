import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getInventoryItem, listStockHistory } from "@/lib/actions/inventory";
import { StockAdjustForm } from "@/components/dashboard/stock-adjust-form";

const MOVEMENT_LABELS: Record<string, string> = {
  RESTOCK: "Restock",
  SALE: "Sale",
  RETURN: "Return",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  CORRECTION: "Correction",
};

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ slug: string; inventoryItemId: string }>;
}) {
  const { slug, inventoryItemId } = await params;
  const item = await getInventoryItem(slug, inventoryItemId);
  if (!item) notFound();

  const history = await listStockHistory(slug, inventoryItemId);

  return (
    <div className="max-w-2xl">
      <Link href={`/${slug}/admin/inventory`} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to inventory
      </Link>

      <h1 className="mb-1 text-xl font-semibold">{item.productName}</h1>
      <p className="mb-6 text-sm text-muted-foreground font-mono">{item.sku ?? "No SKU set"}</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">Selling price</p>
          <p className="mt-1 text-lg font-semibold">{item.currency} {item.sellingPrice.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="mt-1 text-lg font-semibold">{item.costPrice != null ? `${item.currency} ${item.costPrice.toLocaleString()}` : "—"}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">Profit</p>
          <p className="mt-1 text-lg font-semibold text-green-700">
            {item.profitPerUnit != null ? `${item.currency} ${item.profitPerUnit.toLocaleString()}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">Margin</p>
          <p className="mt-1 text-lg font-semibold text-green-700">{item.marginPercent != null ? `${item.marginPercent}%` : "—"}</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-background p-4">
        <p className="text-sm">
          Currently <strong>{item.quantity}</strong> in stock
          {item.status !== "IN_STOCK" && (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${item.status === "OUT_OF_STOCK" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}>
              {item.status === "OUT_OF_STOCK" ? "Out of stock" : "Low stock"}
            </span>
          )}
        </p>
        {item.status === "OUT_OF_STOCK" && item.isPublished === false && (
          <p className="mt-1 text-xs text-muted-foreground">
            This listing was automatically taken down when it ran out — it'll go back up automatically once you restock.
          </p>
        )}
      </div>

      <div className="mb-6">
        <StockAdjustForm storeSlug={slug} inventoryItemId={inventoryItemId} currentThreshold={item.lowStockThreshold} />
      </div>

      <div className="rounded-lg border bg-background">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Stock history</h2>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Change</th>
              <th className="px-4 py-2">Balance after</th>
              <th className="px-4 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="border-b last:border-0">
                <td className="px-4 py-3 text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{MOVEMENT_LABELS[h.type] ?? h.type}</td>
                <td className={`px-4 py-3 font-medium ${h.quantityChange >= 0 ? "text-green-700" : "text-destructive"}`}>
                  {h.quantityChange >= 0 ? "+" : ""}
                  {h.quantityChange}
                </td>
                <td className="px-4 py-3">{h.quantityAfter}</td>
                <td className="px-4 py-3 text-muted-foreground">{h.note ?? "—"}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No stock movements recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
