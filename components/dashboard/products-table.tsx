"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, PackageOpen, Plus, RotateCcw, Search, Tag } from "lucide-react";
import { ProductRowActions } from "@/components/dashboard/product-row-actions";
import { bulkUpdateProducts } from "@/lib/actions/bulk";
import { deleteProduct } from "@/lib/actions/product";
import type { BusinessTerminology } from "@/lib/business-terminology";
import { formatNumber } from "@/lib/i18n/locale";

type Category = { id: string; name: string };

type ProductRow = {
  id: string;
  name: string;
  images: string[];
  price: number;
  currency: string;
  isPublished: boolean;
  /** Deleted but kept for order/stock history. Hidden unless the "Archived" filter is chosen. */
  archived?: boolean;
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
  query,
  pagination,
  addHref,
}: {
  storeSlug: string;
  products: ProductRow[];
  categories: Category[];
  terminology: BusinessTerminology;
  /** Current server-side filters (from the URL). */
  query: { q: string; categoryId: string; status: string; availability: string };
  pagination: { page: number; size: number; total: number; totalPages: number };
  addHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const [priceInput, setPriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [publishInput, setPublishInput] = useState<"" | "publish" | "unpublish">("");

  const [search, setSearch] = useState(query.q);
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;
  const pageSize = pagination.size;
  const rangeStart = pagination.total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, pagination.total);

  function availabilityOf(p: ProductRow): "available" | "low" | "out" {
    const qty = p.inventory?.quantity;
    if (qty === undefined || qty === null) return "available";
    if (qty <= 0) return "out";
    if (p.inventory?.lowStockThreshold !== undefined && qty <= p.inventory.lowStockThreshold) return "low";
    return "available";
  }

  // Filters and pages live in the URL and are applied by the server, so every product is reachable.
  function go(changes: Record<string, string | number>) {
    const params = new URLSearchParams();
    const base: Record<string, string | number> = { q: query.q, category: query.categoryId, status: query.status, avail: query.availability, size: pageSize };
    const next = { ...base, ...changes };
    if (!("page" in changes)) delete (next as Record<string, unknown>).page;
    for (const [k, v] of Object.entries(next)) if (v !== "" && v !== undefined && !(k === "size" && v === 20)) params.set(k, String(v));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // Bulk actions only touch rows on the current page that are selected.
  const visibleSelected = useMemo(() => products.filter((p) => selected.has(p.id)), [products, selected]);
  const paged = products;

  const allSelected = paged.length > 0 && paged.every((p) => selected.has(p.id));

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

  async function bulkDelete() {
    if (visibleSelected.length === 0) return;
    if (!window.confirm(`Delete ${visibleSelected.length} selected? Anything with orders or stock history is archived instead of deleted.`)) return;
    setIsSaving(true);
    let deleted = 0, archived = 0, failed = 0;
    for (const row of visibleSelected) {
      const r = await deleteProduct(storeSlug, row.id);
      if (!r.success) failed++;
      else if (r.data?.archived) archived++;
      else deleted++;
    }
    setIsSaving(false);
    setSelected(new Set());
    const parts = [deleted && `${deleted} deleted`, archived && `${archived} archived`, failed && `${failed} failed`].filter(Boolean);
    (failed ? toast.error : toast.success)(parts.join(", ") || "Nothing changed");
    router.refresh();
  }

  const hasChanges = priceInput.trim() !== "" || quantityInput.trim() !== "" || categoryInput !== "" || publishInput !== "";

  async function applyBulkEdit() {
    if (visibleSelected.length === 0) return;
    if (!hasChanges) {
      toast.error("Set at least one field to apply.");
      return;
    }

    setIsSaving(true);
    const patches = visibleSelected.map((row) => row.id).map((productId) => ({
      productId,
      price: priceInput.trim() !== "" ? Number(priceInput) : undefined,
      // Rows that don't track stock here (digital, rental) are skipped for the stock field.
      quantity: quantityInput.trim() !== "" && products.find((p) => p.id === productId)?.inventory ? Number(quantityInput) : undefined,
      expectedQuantity: quantityInput.trim() !== "" ? products.find((p) => p.id === productId)?.inventory?.quantity : undefined,
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

  const selectedLabel = `${visibleSelected.length} selected`;
  const filtering = Boolean(query.q || query.categoryId || query.status || query.availability);
  const field = "h-10 rounded-xl border bg-background px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--bn-admin-orange)_45%,transparent)]";
  const tabs: { label: string; value: string }[] = [
    { label: "All", value: "" },
    { label: "Active", value: "published" },
    { label: "Inactive", value: "draft" },
    { label: "Archived", value: "archived" },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1" role="tablist" aria-label="Status">
        {tabs.map((t) => {
          const on = query.status === t.value;
          return (
            <button
              key={t.value || "all"}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go({ status: t.value })}
              className={`shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${on ? "bg-background text-[var(--bn-admin-orange)] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${terminology.catalog.toLowerCase()} (press Enter)`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go({ q: search.trim() }); }}
            className={`${field} w-full pl-10 pr-3`}
          />
        </div>
        <select value={query.categoryId} onChange={(e) => go({ category: e.target.value })} className={field}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={query.availability} onChange={(e) => go({ avail: e.target.value })} className={field}>
          <option value="">All availability</option>
          <option value="available">Available</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        {filtering && (
          <button
            type="button"
            onClick={() => { setSearch(""); router.push(pathname); }}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--bn-admin-orange)] transition hover:bg-[var(--bn-admin-orange-soft)]"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      {visibleSelected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--bn-admin-orange)_30%,transparent)] bg-[var(--bn-admin-orange-soft)] p-4">
          <span className="self-center rounded-full bg-[var(--bn-admin-orange)] px-3 py-1 text-xs font-bold text-white">{selectedLabel}</span>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Price
            <input type="number" min="0" step="0.01" placeholder="Unchanged" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} className="h-9 w-28 rounded-lg border bg-background px-2 text-sm" />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Stock
            <input type="number" min="0" step="1" placeholder="Unchanged" value={quantityInput} onChange={(e) => setQuantityInput(e.target.value)} className="h-9 w-24 rounded-lg border bg-background px-2 text-sm" />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Category
            <select value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="h-9 w-40 rounded-lg border bg-background px-2 text-sm">
              <option value="">Unchanged</option>
              <option value="__none__">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Status
            <select value={publishInput} onChange={(e) => setPublishInput(e.target.value as typeof publishInput)} className="h-9 w-32 rounded-lg border bg-background px-2 text-sm">
              <option value="">Unchanged</option>
              <option value="publish">Published</option>
              <option value="unpublish">Draft</option>
            </select>
          </label>

          <button
            onClick={applyBulkEdit}
            disabled={isSaving || !hasChanges}
            className="h-9 rounded-lg bg-[var(--bn-admin-orange)] px-4 text-sm font-bold text-white transition hover:bg-[var(--bn-admin-orange-dark)] disabled:opacity-50"
          >
            {isSaving ? "Applying…" : "Apply to selected"}
          </button>
          <button
            onClick={bulkDelete}
            disabled={isSaving}
            className="h-9 rounded-lg border border-destructive/40 bg-background px-4 text-sm font-semibold text-destructive transition hover:bg-destructive/5 disabled:opacity-50"
          >
            Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} className="h-9 px-2 text-sm font-medium text-muted-foreground hover:underline">
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on this page" className="h-4 w-4 accent-[var(--bn-admin-orange)]" />
              </th>
              <th className="px-3 py-3">{terminology.catalogSingular}</th>
              <th className="px-3 py-3">Price</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Availability</th>
              <th className="px-3 py-3 text-right">Orders</th>
              <th className="sticky right-0 bg-muted px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => {
              const availability = availabilityOf(p);
              const live = p.isPublished && !p.archived;
              const isSel = selected.has(p.id);
              return (
                <tr key={p.id} className={`group border-b transition-colors last:border-0 ${isSel ? "bg-[var(--bn-admin-orange-soft)]" : "hover:bg-muted/30"}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSel} onChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} className="h-4 w-4 accent-[var(--bn-admin-orange)]" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3.5">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="h-12 w-12 shrink-0 rounded-xl border object-cover" />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><PackageOpen className="h-5 w-5" /></div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><Tag className="h-3 w-3" />{p.category?.name ?? "No category"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold tabular-nums">{p.currency} {formatNumber(Number(p.price))}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                      {p.archived ? "Archived" : p.isPublished ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        availability === "out" ? "bg-red-50 text-red-600" : availability === "low" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {availability === "out" ? "Out of stock" : availability === "low" ? "Low stock" : "Available"}
                      {p.inventory && availability !== "out" ? ` · ${formatNumber(p.inventory.quantity)}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{p.orders}</td>
                  <td className={`sticky right-0 px-4 py-3 text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] ${isSel ? "bg-[var(--bn-admin-orange-soft)]" : "bg-background group-hover:bg-muted/30"}`}>
                    <ProductRowActions storeSlug={storeSlug} productId={p.id} productName={p.name} isPublished={p.isPublished} archived={p.archived} />
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]"><PackageOpen className="h-7 w-7" /></span>
                  {filtering ? (
                    <>
                      <p className="font-semibold">No {terminology.catalog.toLowerCase()} match your filters</p>
                      <button type="button" onClick={() => { setSearch(""); router.push(pathname); }} className="mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted/60"><RotateCcw className="h-4 w-4" />Clear filters</button>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">No {terminology.catalog.toLowerCase()} yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">Add your first {terminology.catalogSingular.toLowerCase()} to get your storefront started.</p>
                      {addHref && (
                        <Link href={addHref} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--bn-admin-orange)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--bn-admin-orange-dark)]"><Plus className="h-4 w-4" />Add {terminology.catalogSingular.toLowerCase()}</Link>
                      )}
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3 text-sm text-muted-foreground">
            <span>Showing {rangeStart}–{rangeEnd} of {pagination.total}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => go({ page: Math.max(1, currentPage - 1) })} className="grid h-8 w-8 place-items-center rounded-lg border transition hover:bg-muted/60 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
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
                        aria-current={n === currentPage ? "page" : undefined}
                        onClick={() => go({ page: n })}
                        className={`h-8 min-w-8 rounded-lg border px-2 text-sm transition ${n === currentPage ? "border-[var(--bn-admin-orange)] bg-[var(--bn-admin-orange)] font-bold text-white" : "hover:bg-muted/60"}`}
                      >
                        {n}
                      </button>
                    )
                  )}
                <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => go({ page: Math.min(totalPages, currentPage + 1) })} className="grid h-8 w-8 place-items-center rounded-lg border transition hover:bg-muted/60 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <select value={pageSize} onChange={(e) => go({ size: Number(e.target.value) })} className="h-8 rounded-lg border bg-background px-2 text-sm">
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
