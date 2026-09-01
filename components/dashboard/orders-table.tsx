"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListToolbar, ListPagination } from "@/components/dashboard/list-toolbar";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
  PAID: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-700",
  REFUNDED: "bg-gray-200 text-gray-700",
  DISPUTED: "bg-destructive/10 text-destructive",
};

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

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((order) => (
              <tr key={order.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">#{order.id.slice(-8).toUpperCase()}</td>
                <td className="px-4 py-3">
                  {order.customerName}
                  {order.channel === "POS" && (
                    <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">POS</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{order.itemCount}</td>
                <td className="px-4 py-3">{order.currency} {order.total.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"}`}>
                    {order.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/${storeSlug}/admin/orders/${order.id}`} className="text-xs font-medium text-primary hover:underline">View</Link>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  {orders.length === 0 ? "No orders yet." : "No orders match your filters."}
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
