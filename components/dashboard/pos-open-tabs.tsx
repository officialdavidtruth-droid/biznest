"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { settlePosTab, postPosTabToRoom, type PosTabSummary } from "@/lib/actions/pos-tabs";
import type { InHouseReservation } from "@/lib/actions/folio";
import { posTenderTypes } from "@/lib/validations/pos";
import { formatNumber } from "@/lib/i18n/locale";

/**
 * Tables with a running bill. Everything rung up "to the table" shows here, grouped by round,
 * until the guest pays once at the end (Cash / Card / Transfer) or the bill is moved onto a
 * checked-in guest's room.
 */
export function PosOpenTabs({
  slug,
  tabs,
  inHouseRooms = [],
  onChanged,
}: {
  slug: string;
  tabs: PosTabSummary[];
  inHouseRooms?: InHouseReservation[];
  /** Called after a tab is closed, for hosts that hold the tab list in their own state. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roomFor, setRoomFor] = useState<Record<string, string>>({});

  async function pay(tab: PosTabSummary, tender: string) {
    if (busyId) return;
    if (!window.confirm(`Take ${tab.currency} ${formatNumber(tab.total)} from ${tab.label} by ${tender.toLowerCase()} and close the bill?`)) return;
    setBusyId(tab.id);
    try {
      const result = await settlePosTab(slug, tab.id, tender);
      if (!result.success) return void toast.error(result.error);
      toast.success(`${tab.label} paid — ${tab.currency} ${formatNumber(result.data.total)}`);
      router.refresh();
      onChanged?.();
    } catch {
      toast.error("Couldn't reach the server. Check the tab before trying again.");
    } finally {
      setBusyId(null);
    }
  }

  async function toRoom(tab: PosTabSummary) {
    const reservationId = roomFor[tab.id];
    if (!reservationId || busyId) return void (!reservationId && toast.error("Choose a room first."));
    setBusyId(tab.id);
    try {
      const result = await postPosTabToRoom(slug, tab.id, reservationId);
      if (!result.success) return void toast.error(result.error);
      toast.success(`${tab.label} charged to room ${result.data.roomName}.`);
      router.refresh();
      onChanged?.();
    } catch {
      toast.error("Couldn't reach the server. Check the tab before trying again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-lg border bg-background" aria-label="Open table tabs">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Open table tabs</h2>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tabs.length}</span>
      </div>
      {tabs.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No open tabs. In the register choose &quot;Add to table tab&quot; and a table — its running bill appears here.
        </p>
      ) : (
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {tabs.map((tab) => (
            <div key={tab.id} className="flex flex-col rounded-lg border">
              <div className="flex items-start justify-between gap-2 border-b p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{tab.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {tab.customerName ? `${tab.customerName} · ` : ""}
                    {tab.orders.length} {tab.orders.length === 1 ? "order" : "orders"} · since{" "}
                    {new Date(tab.openedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <p className="shrink-0 text-base font-bold">
                  {tab.currency} {formatNumber(tab.total)}
                </p>
              </div>
              <div className="max-h-44 flex-1 space-y-2 overflow-y-auto p-3 text-xs">
                {tab.orders.map((o) => (
                  <div key={o.id}>
                    <p className="mb-0.5 font-medium text-muted-foreground">
                      #{o.code} · {new Date(o.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                    {o.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between gap-2">
                        <span className="truncate">{i.quantity} × {i.name}</span>
                        <span className="shrink-0 text-muted-foreground">{formatNumber(i.unitPrice * i.quantity)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t p-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {posTenderTypes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={busyId === tab.id}
                      onClick={() => pay(tab, t)}
                      className="rounded-md border py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Pay {t.toLowerCase()}
                    </button>
                  ))}
                </div>
                {inHouseRooms.length > 0 && (
                  <div className="flex gap-1.5">
                    <select
                      value={roomFor[tab.id] ?? ""}
                      onChange={(e) => setRoomFor((prev) => ({ ...prev, [tab.id]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="">Charge to room…</option>
                      {inHouseRooms.map((r) => (
                        <option key={r.id} value={r.id}>Room {r.roomName} · {r.guestName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyId === tab.id || !roomFor[tab.id]}
                      onClick={() => toRoom(tab)}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Post
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
