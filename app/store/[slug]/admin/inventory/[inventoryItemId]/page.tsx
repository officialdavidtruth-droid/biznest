// Route: /store/[slug]/admin/inventory/[inventoryItemId]
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getInventoryItem, listStockHistory } from "@/lib/actions/inventory";
import { StockAdjustForm } from "@/components/dashboard/stock-adjust-form";
import { formatDate, formatNumber } from "@/lib/i18n/locale";

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

  const tile = "rounded-2xl border bg-background p-4 shadow-sm";
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/store/${slug}/admin/inventory`} className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to inventory
      </Link>

      <h1 className="text-xl font-bold">{item.productName}</h1>
      <p className="mb-4 mt-0.5 font-mono text-xs text-muted-foreground">{item.sku ?? "No SKU set"}</p>

      <div className="mb-4 rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">In stock</p>
            <p className="text-4xl font-bold tabular-nums">{formatNumber(item.quantity)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "OUT_OF_STOCK" ? "bg-red-100 text-red-700" : item.status === "IN_STOCK" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {item.status === "OUT_OF_STOCK" ? "Out of stock" : item.status === "IN_STOCK" ? "In stock" : "Low stock"}
          </span>
        </div>
        {item.status === "OUT_OF_STOCK" && item.isPublished === false && (
          <p className="mt-3 text-xs text-muted-foreground">
            This listing was taken down automatically when it ran out. It goes back up when you restock.
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className={tile}>
          <p className="text-xs text-muted-foreground">Selling price</p>
          <p className="mt-1 text-base font-bold tabular-nums">{item.currency} {formatNumber(item.sellingPrice)}</p>
        </div>
        <div className={tile}>
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="mt-1 text-base font-bold tabular-nums">{item.costPrice != null ? `${item.currency} ${formatNumber(item.costPrice)}` : "Not set"}</p>
        </div>
        <div className={tile}>
          <p className="text-xs text-muted-foreground">Profit per unit</p>
          <p className="mt-1 text-base font-bold tabular-nums text-emerald-700">{item.profitPerUnit != null ? `${item.currency} ${formatNumber(item.profitPerUnit)}` : "—"}</p>
        </div>
        <div className={tile}>
          <p className="text-xs text-muted-foreground">Margin</p>
          <p className="mt-1 text-base font-bold tabular-nums text-emerald-700">{item.marginPercent != null ? `${item.marginPercent}%` : "—"}</p>
        </div>
      </div>

      <div className="mb-4">
        <StockAdjustForm storeSlug={slug} inventoryItemId={inventoryItemId} currentThreshold={item.lowStockThreshold} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Stock history</h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            No stock movements yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-2xl border bg-background p-3.5 shadow-sm">
                <span className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${h.quantityChange >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                  {h.quantityChange >= 0 ? "+" : ""}{h.quantityChange}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{MOVEMENT_LABELS[h.type] ?? h.type}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(new Date(h.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{h.note ? ` · ${h.note}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-sm font-bold tabular-nums">{formatNumber(h.quantityAfter)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
