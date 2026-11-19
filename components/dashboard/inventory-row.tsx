"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, Wand2 } from "lucide-react";
import {
  updateCostPrice, updateSku, generateSku, updateBarcode, generateBarcode,
  updateVariantCostPrice, updateVariantSku, updateVariantBarcode,
  type InventoryOverviewItem,
} from "@/lib/actions/inventory";
import { generateVariantSku, generateVariantBarcode } from "@/lib/actions/variant";
import { formatNumber } from "@/lib/i18n/locale";

const STATUS_STYLES: Record<InventoryOverviewItem["status"], { pill: string; dot: string; bar: string }> = {
  OUT_OF_STOCK: { pill: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500", bar: "bg-red-500" },
  LOW_STOCK: { pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-400", bar: "bg-amber-400" },
  IN_STOCK: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-600", bar: "bg-emerald-600" },
};
const STATUS_LABELS: Record<InventoryOverviewItem["status"], string> = {
  OUT_OF_STOCK: "Sold out",
  LOW_STOCK: "Running low",
  IN_STOCK: "In stock",
};

export function InventoryRow({ storeSlug, item }: { storeSlug: string; item: InventoryOverviewItem }) {
  const router = useRouter();
  const [costPrice, setCostPrice] = useState(item.costPrice != null ? String(item.costPrice) : "");
  const [sku, setSku] = useState(item.sku ?? "");
  const [barcode, setBarcode] = useState(item.barcode ?? "");
  const [savingCost, setSavingCost] = useState(false);
  const [savingSku, setSavingSku] = useState(false);
  const [savingBarcode, setSavingBarcode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [open, setOpen] = useState(false);
  const isVariant = item.stockType === "VARIANT";

  async function saveCost() {
    setSavingCost(true);
    const result = await (isVariant ? updateVariantCostPrice : updateCostPrice)(storeSlug, item.inventoryItemId, costPrice === "" ? null : Number(costPrice));
    setSavingCost(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Cost price updated.");
    router.refresh();
  }

  async function saveSku() {
    setSavingSku(true);
    const result = await (isVariant ? updateVariantSku : updateSku)(storeSlug, item.inventoryItemId, sku);
    setSavingSku(false);
    if (!result.success) return toast.error(result.error);
    toast.success("SKU updated.");
    router.refresh();
  }

  async function handleGenerateSku() {
    setGenerating(true);
    const result = await (isVariant ? generateVariantSku : generateSku)(storeSlug, item.inventoryItemId);
    setGenerating(false);
    if (!result.success) return toast.error(result.error);
    setSku(result.data.sku);
    toast.success("SKU generated.");
    router.refresh();
  }

  async function saveBarcode() {
    setSavingBarcode(true);
    const result = await (isVariant ? updateVariantBarcode : updateBarcode)(storeSlug, item.inventoryItemId, barcode);
    setSavingBarcode(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Barcode updated.");
    router.refresh();
  }

  async function handleGenerateBarcode() {
    setGeneratingBarcode(true);
    const result = await (isVariant ? generateVariantBarcode : generateBarcode)(storeSlug, item.inventoryItemId);
    setGeneratingBarcode(false);
    if (!result.success) return toast.error(result.error);
    setBarcode(result.data.barcode);
    toast.success("Barcode generated.");
    router.refresh();
  }

  const st = STATUS_STYLES[item.status];
  const fill = item.quantity <= 0 ? 0 : Math.max(6, Math.min(100, Math.round((item.quantity / Math.max(item.lowStockThreshold * 3, 1)) * 100)));
  const costDirty = costPrice !== (item.costPrice != null ? String(item.costPrice) : "");
  const manageHref = isVariant ? `/${storeSlug}/admin/products/${item.productId}/edit` : `/${storeSlug}/admin/inventory/${item.inventoryItemId}`;
  const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
  const saveBtn = "shrink-0 rounded-lg bg-[#0f6410] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50";
  const wandBtn = "shrink-0 rounded-lg border p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50";

  return (
    <li>
      <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_9rem_6.5rem] md:items-center md:gap-4">
        {/* Product */}
        <div className="flex min-w-0 items-center gap-3">
          {item.productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.productImage} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-black/5" />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-500">{item.productName.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{item.productName}</p>
            <p className="truncate text-xs text-gray-500">
              {[item.variantLabel, item.sku].filter(Boolean).join(" · ") || "No SKU yet"}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset md:hidden ${st.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            {STATUS_LABELS[item.status]}
          </span>
        </div>

        {/* Stock + price (side by side on phones) */}
        <div className="grid grid-cols-2 gap-4 md:contents">
          <div>
            <p className="text-[11px] text-gray-400 md:hidden">Stock</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900">{item.quantity} <span className="text-xs font-normal text-gray-500">units</span></p>
            <div className="mt-1.5 h-1.5 w-full max-w-[9rem] overflow-hidden rounded-full bg-gray-100">
              <span className={`block h-full rounded-full ${st.bar}`} style={{ width: `${fill}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Alert at {item.lowStockThreshold}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 md:hidden">Price</p>
            <p className="text-sm font-semibold tabular-nums text-gray-900">{item.currency} {formatNumber(item.sellingPrice)}</p>
            {item.marginPercent != null && item.profitPerUnit != null ? (
              <p className={`mt-0.5 text-xs tabular-nums ${item.profitPerUnit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                +{item.currency} {formatNumber(item.profitPerUnit)} · {item.marginPercent}%
              </p>
            ) : (
              <button type="button" onClick={() => setOpen(true)} className="mt-0.5 text-xs font-medium text-[#0f6410] hover:underline">Add cost price</button>
            )}
          </div>
        </div>

        {/* Status (desktop) */}
        <div className="hidden md:block">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${st.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            {STATUS_LABELS[item.status]}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 md:flex-none md:py-1.5"
          >
            Edit <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <Link href={manageHref} className="inline-flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium text-[#0f6410] hover:bg-emerald-50 md:flex-none md:py-1.5">
            Manage
          </Link>
        </div>
      </div>

      {open && (
        <div className="grid gap-4 border-t bg-gray-50/70 px-4 py-4 sm:grid-cols-3 sm:px-5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">SKU</span>
            <div className="flex gap-1.5">
              <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Not set" className={`${field} font-mono text-xs`} />
              <button type="button" title="Generate SKU" onClick={handleGenerateSku} disabled={generating} className={wandBtn}><Wand2 className="h-4 w-4" /></button>
              {sku !== (item.sku ?? "") && <button type="button" onClick={saveSku} disabled={savingSku} className={saveBtn}>Save</button>}
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">Barcode</span>
            <div className="flex gap-1.5">
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Not set" className={`${field} font-mono text-xs`} />
              <button type="button" title="Generate barcode" onClick={handleGenerateBarcode} disabled={generatingBarcode} className={wandBtn}><Wand2 className="h-4 w-4" /></button>
              {barcode !== (item.barcode ?? "") && <button type="button" onClick={saveBarcode} disabled={savingBarcode} className={saveBtn}>Save</button>}
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">Cost price ({item.currency})</span>
            <div className="flex gap-1.5">
              <input type="number" inputMode="decimal" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="Not set" className={field} />
              {costDirty && <button type="button" onClick={saveCost} disabled={savingCost} className={saveBtn}>Save</button>}
            </div>
          </label>
        </div>
      )}
    </li>
  );
}
