"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListToolbar, ListPagination } from "@/components/dashboard/list-toolbar";
import { BookingStatusBadge } from "@/components/dashboard/booking-status-badge";

type BookingRow = {
  id: string;
  scheduledAt: string;
  serviceName: string;
  customerName: string;
  status: string;
  query: string;
};

export function BookingsTable({ storeSlug, bookings }: { storeSlug: string; bookings: BookingRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const statuses = useMemo(() => Array.from(new Set(bookings.map((b) => b.status))), [bookings]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!b.customerName.toLowerCase().includes(q) && !b.serviceName.toLowerCase().includes(q)) return false;
      }
      if (statusFilter && b.status !== statusFilter) return false;
      return true;
    });
  }, [bookings, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <ListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search bookings or customers..."
        filters={[
          { id: "status", value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(1); }, placeholder: "All Status", options: statuses.map((s) => ({ value: s, label: s })) },
        ]}
        onReset={() => { setSearch(""); setStatusFilter(""); setPage(1); }}
      />

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-3">{new Date(b.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-3">{b.serviceName}</td>
                <td className="px-4 py-3">
                  <Link href={`/${storeSlug}/admin/customers?${b.query}`} className="text-muted-foreground hover:text-primary hover:underline">
                    {b.customerName}
                  </Link>
                </td>
                <td className="px-4 py-3"><BookingStatusBadge status={b.status} /></td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">{bookings.length === 0 ? "No bookings yet." : "No bookings match your filters."}</td></tr>
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
