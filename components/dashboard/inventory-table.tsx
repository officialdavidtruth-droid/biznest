"use client";

import { useMemo, useState } from "react";
import { PackageOpen, Search } from "lucide-react";
import { ListPagination } from "@/components/dashboard/list-toolbar";
import { InventoryRow } from "@/components/dashboard/inventory-row";
import type { InventoryOverviewItem } from "@/lib/actions/inventory";

type Filter = "" | InventoryOverviewItem["status"];

export function InventoryTable({ storeSlug, items }: { storeSlug: string; items: InventoryOverviewItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Filter>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const counts = useMemo(
    () => ({
      "": items.length,
      IN_STOCK: items.filter((i) => i.status === "IN_STOCK").length,
      LOW_STOCK: items.filter((i) => i.status === "LOW_STOCK").length,
      OUT_OF_STOCK: items.filter((i) => i.status === "OUT_OF_STOCK").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.productName.toLowerCase().includes(q) && !(i.variantLabel ?? "").toLowerCase().includes(q) && !(i.sku ?? "").toLowerCase().includes(q) && !(i.barcode ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter && i.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const tabs: Array<{ id: Filter; label: string }> = [
    { id: "", label: "All" },
    { id: "IN_STOCK", label: "In stock" },
    { id: "LOW_STOCK", label: "Low" },
    { id: "OUT_OF_STOCK", label: "Sold out" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, SKU or barcode"
            className="w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-3 text-sm focus:bg-white"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by stock status">
          {tabs.map((t) => {
            const active = statusFilter === t.id;
            return (
              <button
                key={t.id || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setStatusFilter(t.id); setPage(1); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium ${active ? "border-[#0f6410] bg-[#0f6410] text-white" : "bg-background text-gray-600 hover:bg-gray-50"}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{counts[t.id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_7rem_6rem] gap-4 border-y bg-gray-50/70 px-5 py-2 text-[11px] font-medium text-gray-500 md:grid">
        <span>Product</span>
        <span>Stock</span>
        <span>Price &amp; margin</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>

      <ul className="divide-y border-t md:border-t-0">
        {paged.map((item) => (
          <InventoryRow key={item.inventoryItemId} storeSlug={storeSlug} item={item} />
        ))}
      </ul>

      {paged.length === 0 && (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400"><PackageOpen className="h-6 w-6" /></span>
          <p className="mt-3 text-sm font-medium text-gray-900">{items.length === 0 ? "Nothing tracked yet" : "No items match"}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {items.length === 0 ? "Physical products get an inventory row automatically once you add them." : "Try a different search or switch the filter above."}
          </p>
        </div>
      )}

      <ListPagination
        page={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </section>
  );
}
