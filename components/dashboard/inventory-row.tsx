"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { updateCostPrice, updateSku, generateSku, type InventoryOverviewItem } from "@/lib/actions/inventory";

const STATUS_STYLES: Record<InventoryOverviewItem["status"], string> = {
  OUT_OF_STOCK: "bg-destructive/10 text-destructive",
  LOW_STOCK: "bg-amber-100 text-amber-700",
  IN_STOCK: "bg-green-100 text-green-700",
};
const STATUS_LABELS: Record<InventoryOverviewItem["status"], string> = {
  OUT_OF_STOCK: "Out of stock",
  LOW_STOCK: "Low stock",
  IN_STOCK: "In stock",
};

export function InventoryRow({ storeSlug, item }: { storeSlug: string; item: InventoryOverviewItem }) {
  const router = useRouter();
  const [costPrice, setCostPrice] = useState(item.costPrice != null ? String(item.costPrice) : "");
  const [sku, setSku] = useState(item.sku ?? "");
  const [savingCost, setSavingCost] = useState(false);
  const [savingSku, setSavingSku] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function saveCost() {
    setSavingCost(true);
    const result = await updateCostPrice(storeSlug, item.inventoryItemId, costPrice === "" ? null : Number(costPrice));
    setSavingCost(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Cost price updated.");
    router.refresh();
  }

  async function saveSku() {
    setSavingSku(true);
    const result = await updateSku(storeSlug, item.inventoryItemId, sku);
    setSavingSku(false);
    if (!result.success) return toast.error(result.error);
    toast.success("SKU updated.");
    router.refresh();
  }

  async function handleGenerateSku() {
    setGenerating(true);
    const result = await generateSku(storeSlug, item.inventoryItemId);
    setGenerating(false);
    if (!result.success) return toast.error(result.error);
    setSku(result.data.sku);
    toast.success("SKU generated.");
    router.refresh();
  }

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-4 py-3 font-medium">{item.productName}</td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="—"
            className="w-28 rounded-md border px-2 py-1 font-mono text-xs"
          />
          <button
            title="Generate SKU"
            onClick={handleGenerateSku}
            disabled={generating}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
          </button>
          {sku !== (item.sku ?? "") && (
            <button onClick={saveSku} disabled={savingSku} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
              Save
            </button>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{item.currency}</span>
          <input
            type="number"
            min="0"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="Not set"
            className="w-24 rounded-md border px-2 py-1 text-xs"
          />
          {costPrice !== (item.costPrice != null ? String(item.costPrice) : "") && (
            <button onClick={saveCost} disabled={savingCost} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
              Save
            </button>
          )}
        </div>
      </td>

      <td className="px-4 py-3">{item.currency} {item.sellingPrice.toLocaleString()}</td>

      <td className="px-4 py-3">
        {item.profitPerUnit != null ? (
          <span className={item.profitPerUnit >= 0 ? "text-green-700" : "text-destructive"}>
            {item.currency} {item.profitPerUnit.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        {item.marginPercent != null ? (
          <span className={item.marginPercent >= 0 ? "text-green-700" : "text-destructive"}>{item.marginPercent}%</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      <td className="px-4 py-3">{item.quantity}</td>

      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
      </td>

      <td className="px-4 py-3 text-right">
        <Link href={`/store/${storeSlug}/admin/inventory/${item.inventoryItemId}`} className="text-xs font-medium text-primary hover:underline">
          Manage
        </Link>
      </td>
    </tr>
  );
}
