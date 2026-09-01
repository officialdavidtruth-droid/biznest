"use client";

import { useMemo, useState } from "react";
import { ListToolbar, ListPagination } from "@/components/dashboard/list-toolbar";
import { InventoryRow } from "@/components/dashboard/inventory-row";
import type { InventoryOverviewItem } from "@/lib/actions/inventory";

const STATUS_OPTIONS = [
  { value: "IN_STOCK", label: "In stock" },
  { value: "LOW_STOCK", label: "Low stock" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
];

export function InventoryTable({ storeSlug, items }: { storeSlug: string; items: InventoryOverviewItem[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!i.productName.toLowerCase().includes(q) && !(i.sku ?? "").toLowerCase().includes(q)) return false;
      }
      if (statusFilter && i.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <ListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by product or SKU..."
        filters={[
          { id: "status", value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(1); }, placeholder: "All Status", options: STATUS_OPTIONS },
        ]}
        onReset={() => { setSearch(""); setStatusFilter(""); setPage(1); }}
      />

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Barcode</th>
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
            {paged.map((item) => (
              <InventoryRow key={item.inventoryItemId} storeSlug={storeSlug} item={item} />
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  {items.length === 0 ? "Nothing tracked yet. Physical products get an inventory row automatically once added." : "No items match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <ListPagination
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
}
