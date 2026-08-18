"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeleteProductButton } from "@/components/dashboard/delete-product-button";
import { bulkUpdateProducts } from "@/lib/actions/bulk";

type Category = { id: string; name: string };

type ProductRow = {
  id: string;
  name: string;
  images: string[];
  price: number;
  currency: string;
  isPublished: boolean;
  category: { id: string; name: string } | null;
  inventory: { quantity: number } | null;
};

export function ProductsTable({
  storeSlug,
  products,
  categories,
}: {
  storeSlug: string;
  products: ProductRow[];
  categories: Category[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const [priceInput, setPriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [publishInput, setPublishInput] = useState<"" | "publish" | "unpublish">("");

  const allSelected = selected.size > 0 && selected.size === products.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasChanges = priceInput.trim() !== "" || quantityInput.trim() !== "" || categoryInput !== "" || publishInput !== "";

  async function applyBulkEdit() {
    if (selected.size === 0) return;
    if (!hasChanges) {
      toast.error("Set at least one field to apply.");
      return;
    }

    setIsSaving(true);
    const patches = Array.from(selected).map((productId) => ({
      productId,
      price: priceInput.trim() !== "" ? Number(priceInput) : undefined,
      quantity: quantityInput.trim() !== "" ? Number(quantityInput) : undefined,
      categoryId: categoryInput !== "" ? (categoryInput === "__none__" ? null : categoryInput) : undefined,
      isPublished: publishInput === "" ? undefined : publishInput === "publish",
    }));

    const result = await bulkUpdateProducts(storeSlug, patches);
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Updated ${result.data.updated} product${result.data.updated === 1 ? "" : "s"}`);
    setSelected(new Set());
    setPriceInput("");
    setQuantityInput("");
    setCategoryInput("");
    setPublishInput("");
    router.refresh();
  }

  const selectedLabel = useMemo(() => `${selected.size} selected`, [selected]);

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
          <span className="text-xs font-medium text-muted-foreground">{selectedLabel}</span>

          <label className="flex flex-col gap-1 text-xs">
            Price
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Unchanged"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-28 rounded-md border px-2 py-1 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            Stock
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Unchanged"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              className="w-24 rounded-md border px-2 py-1 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            Category
            <select
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              className="w-40 rounded-md border px-2 py-1 text-sm"
            >
              <option value="">Unchanged</option>
              <option value="__none__">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            Status
            <select
              value={publishInput}
              onChange={(e) => setPublishInput(e.target.value as typeof publishInput)}
              className="w-32 rounded-md border px-2 py-1 text-sm"
            >
              <option value="">Unchanged</option>
              <option value="publish">Published</option>
              <option value="unpublish">Draft</option>
            </select>
          </label>

          <button
            onClick={applyBulkEdit}
            disabled={isSaving || !hasChanges}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? "Applying…" : "Apply to selected"}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:underline">
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                </td>
                <td className="flex items-center gap-3 px-4 py-3">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded bg-muted" />
                  )}
                  <span className="font-medium">{p.name}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.category?.name ?? "—"}</td>
                <td className="px-4 py-3">{p.currency} {Number(p.price).toLocaleString()}</td>
                <td className="px-4 py-3">{p.inventory?.quantity ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/${storeSlug}/admin/products/${p.id}/edit`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteProductButton storeSlug={storeSlug} productId={p.id} productName={p.name} />
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No products yet. Add your first one to get your storefront started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
