"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListToolbar, ListPagination } from "@/components/dashboard/list-toolbar";
import { formatDate, formatNumber } from "@/lib/i18n/locale";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-muted text-muted-foreground",
  DISPUTED: "bg-red-100 text-red-700",
};
const statusLabel = (s: string) => { const t = s.replace(/_/g, " ").toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

type OrderRow = {
  id: string;
  customerName: string;
  channel: string;
  itemCount: number;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
};

export function OrdersTable({ storeSlug, orders }: { storeSlug: string; orders: OrderRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const statuses = useMemo(() => Array.from(new Set(orders.map((o) => o.status))), [orders]);
  const channels = useMemo(() => Array.from(new Set(orders.map((o) => o.channel))), [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!o.id.toLowerCase().includes(q) && !o.customerName.toLowerCase().includes(q)) return false;
      }
      if (statusFilter && o.status !== statusFilter) return false;
      if (channelFilter && o.channel !== channelFilter) return false;
      return true;
    });
  }, [orders, search, statusFilter, channelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <ListToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search orders or customers..."
        filters={[
          { id: "status", value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(1); }, placeholder: "All Status", options: statuses.map((s) => ({ value: s, label: s.replace("_", " ") })) },
          { id: "channel", value: channelFilter, onChange: (v) => { setChannelFilter(v); setPage(1); }, placeholder: "All Channels", options: channels.map((c) => ({ value: c, label: c })) },
        ]}
        onReset={() => { setSearch(""); setStatusFilter(""); setChannelFilter(""); setPage(1); }}
      />

      {paged.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          {orders.length === 0 ? "No orders yet. They'll show up here as soon as someone buys." : "No orders match your filters."}
        </div>
      ) : (
        <ul className="space-y-3">
          {paged.map((order) => (
            <li key={order.id}>
              <Link
                href={`/store/${storeSlug}/admin/orders/${order.id}`}
                className="block rounded-2xl border bg-background p-4 shadow-sm transition-colors hover:bg-muted/40 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {order.customerName}
                      {order.channel === "POS" && (
                        <span className="ml-2 rounded-full bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 text-[10px] font-semibold text-primary">POS</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">#{order.id.slice(-8).toUpperCase()}</span> · {formatDate(new Date(order.createdAt))} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold tabular-nums">{order.currency} {formatNumber(order.total)}</p>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-2xl border bg-background">
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
