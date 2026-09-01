"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChefHat, Clock3, Flame, PackageCheck } from "lucide-react";
import { updateOrderStatus } from "@/lib/actions/order";

type KitchenItem = { name: string; quantity: number };

type KitchenOrder = {
  id: string;
  displayId: string;
  status: string;
  customerName: string;
  channel: string;
  createdAt: string;
  items: KitchenItem[];
};

const COLUMNS: Array<{ status: "PAID" | "IN_PROGRESS" | "DELIVERED"; label: string; hint: string; icon: any; accent: string; next?: { status: "IN_PROGRESS" | "DELIVERED" | "COMPLETED"; label: string } }> = [
  { status: "PAID", label: "Pending Orders", hint: "Waiting to be prepared", icon: Clock3, accent: "border-amber-300 bg-amber-50", next: { status: "IN_PROGRESS", label: "Start Preparing" } },
  { status: "IN_PROGRESS", label: "Preparing", hint: "Orders currently being prepared", icon: Flame, accent: "border-orange-300 bg-orange-50", next: { status: "DELIVERED", label: "Mark Ready" } },
  { status: "DELIVERED", label: "Ready for Pickup", hint: "Orders ready to be served", icon: PackageCheck, accent: "border-emerald-300 bg-emerald-50", next: { status: "COMPLETED", label: "Served" } },
];

function timeAgo(value: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function KitchenBoard({ slug, initialOrders }: { slug: string; initialOrders: KitchenOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, KitchenOrder[]> = { PAID: [], IN_PROGRESS: [], DELIVERED: [] };
    for (const o of orders) {
      if (map[o.status]) map[o.status].push(o);
    }
    return map;
  }, [orders]);

  async function advance(order: KitchenOrder, status: "IN_PROGRESS" | "DELIVERED" | "COMPLETED") {
    setBusyId(order.id);
    try {
      const result = await updateOrderStatus(slug, order.id, status as any);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (status === "COMPLETED") {
        setOrders((items) => items.filter((o) => o.id !== order.id));
        toast.success("Order served");
      } else {
        setOrders((items) => items.map((o) => (o.id === order.id ? { ...o, status } : o)));
        toast.success(status === "IN_PROGRESS" ? "Started preparing" : "Marked ready");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ChefHat className="h-6 w-6 text-orange-500" /> Kitchen Operations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Track every order from ticket to pickup</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = grouped[col.status] ?? [];
          const Icon = col.icon;
          return (
            <div key={col.status} className={`rounded-xl border p-4 ${col.accent}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <div>
                    <p className="text-sm font-bold">{col.label}</p>
                    <p className="text-xs text-muted-foreground">{col.hint}</p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm">{list.length}</span>
              </div>

              <div className="space-y-3">
                {list.length === 0 && <p className="rounded-lg bg-white/60 p-3 text-center text-xs text-muted-foreground">Nothing here</p>}
                {list.map((order) => (
                  <div key={order.id} className="rounded-lg border bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">#{order.displayId}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(order.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{order.customerName} · {order.channel}</p>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {order.items.map((it, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{it.name}</span>
                          <span className="text-muted-foreground">×{it.quantity}</span>
                        </li>
                      ))}
                    </ul>
                    {col.next && (
                      <button
                        disabled={busyId === order.id}
                        onClick={() => advance(order, col.next!.status)}
                        className="mt-3 w-full rounded-lg bg-orange-500 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                      >
                        {col.next.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
