"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { linkSupplierProduct, unlinkSupplierProduct } from "@/lib/actions/supplier";

type Product = { id: string; name: string };
type Link = { productId: string; productName: string; supplierSku: string | null; costPrice: number | null };

export function SupplierProductLinks({
  storeSlug,
  supplierId,
  products,
  links,
}: {
  storeSlug: string;
  supplierId: string;
  products: Product[];
  links: Link[];
}) {
  const router = useRouter();
  const linkedIds = new Set(links.map((l) => l.productId));
  const available = products.filter((p) => !linkedIds.has(p.id));

  const [productId, setProductId] = useState("");
  const [supplierSku, setSupplierSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleLink() {
    if (!productId) return;
    setIsSaving(true);
    const result = await linkSupplierProduct(storeSlug, supplierId, productId, {
      supplierSku: supplierSku || undefined,
      costPrice: costPrice ? Number(costPrice) : undefined,
    });
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setProductId("");
    setSupplierSku("");
    setCostPrice("");
    router.refresh();
  }

  async function handleUnlink(pid: string) {
    const result = await unlinkSupplierProduct(storeSlug, supplierId, pid);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Product
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-52 rounded-md border px-2 py-1.5 text-sm">
            <option value="">Choose a product…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Supplier SKU
          <input value={supplierSku} onChange={(e) => setSupplierSku(e.target.value)} className="w-32 rounded-md border px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Cost price
          <input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="w-28 rounded-md border px-2 py-1.5 text-sm" />
        </label>
        <button
          onClick={handleLink}
          disabled={!productId || isSaving}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Link product
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Supplier SKU</th>
              <th className="px-4 py-2">Cost price</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.productId} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{l.productName}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.supplierSku || "—"}</td>
                <td className="px-4 py-3">{l.costPrice != null ? l.costPrice.toLocaleString() : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleUnlink(l.productId)} className="text-xs font-medium text-destructive hover:underline">
                    Unlink
                  </button>
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No products linked yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
