"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductRowActions } from "@/components/dashboard/product-row-actions";
import { bulkUpdateProducts } from "@/lib/actions/bulk";
import type { BusinessTerminology } from "@/lib/business-terminology";

type Category = { id: string; name: string };

type ProductRow = {
  id: string;
  name: string;
  images: string[];
  price: number;
  currency: string;
  isPublished: boolean;
  category: { id: string; name: string } | null;
  inventory: { quantity: number; lowStockThreshold?: number } | null;
  orders: number;
};

const PAGE_SIZE_OPTIONS = [8, 20, 50];

export function ProductsTable({
  storeSlug,
  products,
  categories,
  terminology,
}: {
  storeSlug: string;
  products: ProductRow[];
  categories: Category[];
  terminology: BusinessTerminology;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const [priceInput, setPriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [publishInput, setPublishInput] = useState<"" | "publish" | "unpublish">("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "published" | "draft">("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"" | "available" | "low" | "out">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  function availabilityOf(p: ProductRow): "available" | "low" | "out" {
    const qty = p.inventory?.quantity;
    if (qty === undefined || qty === null) return "available";
    if (qty <= 0) return "out";
    if (p.inventory?.lowStockThreshold !== undefined && qty <= p.inventory.lowStockThreshold) return "low";
    return "available";
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (categoryFilter && p.category?.id !== categoryFilter) return false;
      if (statusFilter === "published" && !p.isPublished) return false;
      if (statusFilter === "draft" && p.isPublished) return false;
      if (availabilityFilter && availabilityOf(p) !== availabilityFilter) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter, availabilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const allSelected = selected.size > 0 && paged.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) paged.forEach((p) => next.delete(p.id));
      else paged.forEach((p) => next.add(p.id));
      return next;
    });
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
    toast.success(`Updated ${result.data.updated} ${terminology.catalogSingular.toLowerCase()}${result.data.updated === 1 ? "" : "s"}`);
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${terminology.catalog.toLowerCase()}...`}
            value={search}
            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
            className="w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => resetToFirstPage(setCategoryFilter)(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2.5 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => resetToFirstPage(setStatusFilter)(e.target.value as typeof statusFilter)}
          className="rounded-lg border bg-white px-3 py-2.5 text-sm"
        >
          <option value="">All Status</option>
          <option value="published">Active</option>
          <option value="draft">Inactive</option>
        </select>
        <select
          value={availabilityFilter}
          onChange={(e) => resetToFirstPage(setAvailabilityFilter)(e.target.value as typeof availabilityFilter)}
          className="rounded-lg border bg-white px-3 py-2.5 text-sm"
        >
          <option value="">All Availability</option>
          <option value="available">Available</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <button
          type="button"
          onClick={() => { setSearch(""); setCategoryFilter(""); setStatusFilter(""); setAvailabilityFilter(""); setPage(1); }}
          className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filter
        </button>
      </div>

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
              <th className="px-4 py-2">{terminology.catalogSingular}</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Availability</th>
              <th className="px-4 py-2">Orders</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => {
              const availability = availabilityOf(p);
              return (
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
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.isPublished ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.isPublished ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        availability === "out"
                          ? "bg-red-100 text-red-700"
                          : availability === "low"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      {availability === "out" ? "Out of Stock" : availability === "low" ? "Low Stock" : "Available"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.orders}</td>
                  <td className="px-4 py-3 text-right">
                    <ProductRowActions storeSlug={storeSlug} productId={p.id} productName={p.name} isPublished={p.isPublished} />
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  {products.length === 0
                    ? `No ${terminology.catalog.toLowerCase()} yet. Add your first one to get your storefront started.`
                    : `No ${terminology.catalog.toLowerCase()} match your filters.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {rangeStart} to {rangeEnd} of {filtered.length} items</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border px-2 py-1 disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                  .reduce<number[]>((acc, n) => {
                    if (acc.length && n - acc[acc.length - 1] > 1) acc.push(-1);
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === -1 ? (
                      <span key={`ellipsis-${i}`} className="px-1">…</span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={`rounded-md border px-2.5 py-1 ${n === currentPage ? "border-primary bg-primary/10 font-semibold text-primary" : ""}`}
                      >
                        {n}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border px-2 py-1 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-md border px-2 py-1"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
