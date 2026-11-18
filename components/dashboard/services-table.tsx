"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteService } from "@/lib/actions/service";
import { ListToolbar, ListPagination } from "@/components/dashboard/list-toolbar";
import type { BusinessTerminology } from "@/lib/business-terminology";
import { formatNumber } from "@/lib/i18n/locale";

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  currency: string;
  isBookable: boolean;
  durationMins: number | null;
  isPublished: boolean;
};

export function ServicesTable({ storeSlug, services, terminology }: { storeSlug: string; services: ServiceRow[]; terminology: BusinessTerminology }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "published" | "draft">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (search.trim() && !s.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (statusFilter === "published" && !s.isPublished) return false;
      if (statusFilter === "draft" && s.isPublished) return false;
      return true;
    });
  }, [services, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <ListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={`Search ${terminology.catalog.toLowerCase()}...`}
        filters={[
          { id: "status", value: statusFilter, onChange: (v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }, placeholder: "All Status", options: [{ value: "published", label: "Active" }, { value: "draft", label: "Inactive" }] },
        ]}
        onReset={() => { setSearch(""); setStatusFilter(""); setPage(1); }}
      />

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">{terminology.catalogSingular}</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Booking</th>
              <th className="px-4 py-2">Status</th>
              <th className="sticky right-0 bg-muted px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.currency} {formatNumber(Number(s.price))}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.isBookable ? `${s.durationMins ?? "—"} min slots` : "Not bookable"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.isPublished ? "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]" : "bg-muted text-muted-foreground"}`}>
                    {s.isPublished ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="sticky right-0 bg-background px-4 py-3 text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/${storeSlug}/admin/services/${s.id}/edit`} className="text-xs font-medium text-primary hover:underline">Edit</Link>
                    <button
                      type="button"
                      disabled={deletingId === s.id}
                      onClick={async () => {
                        if (!window.confirm(`Delete "${s.name}"? This can't be undone.`)) return;
                        setDeletingId(s.id);
                        const r = await deleteService(storeSlug, s.id);
                        setDeletingId(null);
                        if (!r.success) return toast.error(r.error);
                        toast.success(r.data?.archived ? "Has bookings or orders, so it was made inactive instead of deleted." : "Deleted");
                        router.refresh();
                      }}
                      className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{services.length === 0 ? terminology.emptyCatalog : `No ${terminology.catalog.toLowerCase()} match your filters.`}</td></tr>
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
