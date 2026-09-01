"use client";

import { Search, SlidersHorizontal } from "lucide-react";

export type FilterSelect = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
};

/**
 * Shared search + dropdown-filters bar used at the top of every admin list
 * page (Products, Orders, Customers, Bookings, ...). Keeps the visual
 * language identical across pages: a flex-wrapped row of a search input,
 * N select filters, and a reset "Filter" button.
 */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  onReset,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters: FilterSelect[];
  onReset: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border bg-white py-2.5 pl-9 pr-3 text-sm"
        />
      </div>
      {filters.map((f) => (
        <select
          key={f.id}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2.5 text-sm"
        >
          <option value="">{f.placeholder}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-slate-50"
      >
        <SlidersHorizontal className="h-4 w-4" /> Filter
      </button>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [8, 20, 50];

/**
 * Shared pagination footer: "Showing X to Y of Z items" + page numbers +
 * a per-page selector. Renders inside the same bordered table wrapper as
 * the table it paginates.
 */
export function ListPagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalItems === 0) return null;
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<number[]>((acc, n) => {
      if (acc.length && n - acc[acc.length - 1] > 1) acc.push(-1);
      acc.push(n);
      return acc;
    }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-3 text-xs text-muted-foreground">
      <span>Showing {rangeStart} to {rangeEnd} of {totalItems} items</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="rounded-md border px-2 py-1 disabled:opacity-40">‹</button>
          {pageNumbers.map((n, i) =>
            n === -1 ? (
              <span key={`ellipsis-${i}`} className="px-1">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPageChange(n)}
                className={`rounded-md border px-2.5 py-1 ${n === page ? "border-primary bg-primary/10 font-semibold text-primary" : ""}`}
              >
                {n}
              </button>
            )
          )}
          <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} className="rounded-md border px-2 py-1 disabled:opacity-40">›</button>
        </div>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border px-2 py-1"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} per page</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// StatCard moved to ./stat-card.tsx — it's pure presentation (no state,
// no handlers), so it doesn't belong in this "use client" file. Keeping it
// here broke server pages (app/store/[slug]/admin/{services,orders,inventory}
// /page.tsx) that pass a lucide-react icon *component* into it: Next.js
// can't serialize an unrendered component reference across the server/client
// boundary ("Functions cannot be passed directly to Client Components").
// Re-exported here so existing "use client" importers (booking-stat-cards,
// category-manager, customer-360) don't need to change their import path.
export { StatCard } from "./stat-card";
