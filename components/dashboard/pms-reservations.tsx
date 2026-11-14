"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { TableScroll } from "@/components/ui/table-scroll";
import { FilterChip, StatusChip, btnGhost, btnPrimary, nightsBetween, panelCls, shortDate, toneOf } from "@/components/dashboard/pms-ui";

const FILTERS: { id: string; label: string; match: (r: any) => boolean }[] = [
  { id: "ALL", label: "All", match: () => true },
  { id: "UPCOMING", label: "Upcoming", match: (r) => ["PENDING", "CONFIRMED"].includes(r.status) },
  { id: "INHOUSE", label: "In-house", match: (r) => r.status === "CHECKED_IN" },
  { id: "DONE", label: "Checked out", match: (r) => r.status === "CHECKED_OUT" },
  { id: "CANCELLED", label: "Cancelled", match: (r) => ["CANCELLED", "NO_SHOW"].includes(r.status) },
];

type Props = {
  reservations: any[];
  search: string;
  setSearch: (v: string) => void;
  onCreate: () => void;
  onCheckIn: (r: any) => void;
  onCancel: (r: any) => void;
  onNoShow: (r: any) => void;
  onRefund: (r: any) => void;
  onPresence: (r: any) => void;
  onCheckOut: (r: any) => void;
};

export function PmsReservations({ reservations, search, setSearch, onCreate, onCheckIn, onCancel, onNoShow, onRefund, onPresence, onCheckOut }: Props) {
  const [filter, setFilter] = useState("ALL");
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, reservations.filter(f.match).length])), [reservations]);
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const rows = reservations.filter(active.match);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reservations</h2>
          <p className="mt-1 text-sm text-[var(--bn-admin-text)]">Every stay, from booking to check-out.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm focus-within:border-emerald-400/50">
            <Search className="h-4 w-4 opacity-60" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest, room or phone" className="w-full min-w-0 bg-transparent outline-none placeholder:opacity-50 sm:w-60" />
          </label>
          <button onClick={onCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400">
            <Plus className="h-4 w-4" /> New reservation
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)} label={f.label} count={counts[f.id]} />)}
      </div>

      <div className={`${panelCls} overflow-hidden`}>
        <TableScroll>
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-[var(--bn-admin-text)]">
              <tr>{["Guest", "Room", "Stay", "Status", "Payment", ""].map((x, i) => <th key={i} className="px-5 py-3.5 font-medium">{x}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${toneOf(r.status).chip} border`}>{(r.guest?.fullName || "?").trim().charAt(0).toUpperCase()}</span>
                      <div className="min-w-0"><p className="truncate font-medium">{r.guest?.fullName}</p><p className="truncate text-xs text-[var(--bn-admin-text)]">{r.guest?.phone || r.guest?.email || "No contact saved"}</p></div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><p className="font-medium">{r.room?.name}</p><p className="text-xs text-[var(--bn-admin-text)]">{r.room?.roomType}</p></td>
                  <td className="px-5 py-4"><p className="tabular-nums">{shortDate(r.checkIn)} to {shortDate(r.checkOut)}</p><p className="text-xs text-[var(--bn-admin-text)]">{nightsBetween(r.checkIn, r.checkOut)} {nightsBetween(r.checkIn, r.checkOut) === 1 ? "night" : "nights"} · #{r.id.slice(-6).toUpperCase()}</p></td>
                  <td className="px-5 py-4"><StatusChip status={r.status} /></td>
                  <td className="px-5 py-4"><StatusChip status={r.paymentStatus || "UNPAID"} /></td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {["PENDING", "CONFIRMED"].includes(r.status) && (
                        <>
                          <button onClick={() => onCheckIn(r)} className={btnPrimary}>Check in</button>
                          <button onClick={() => onCancel(r)} className={btnGhost}>Cancel</button>
                          <button onClick={() => onNoShow(r)} className={btnGhost}>No-show</button>
                        </>
                      )}
                      {r.status === "CANCELLED" && r.paymentStatus === "PAID" && <button onClick={() => onRefund(r)} className={btnPrimary}>Refund</button>}
                      {r.status === "CHECKED_IN" && (
                        <>
                          <button onClick={() => onPresence(r)} className={btnGhost}>{r.guestPresence === "IN" ? "Mark out" : "Mark in"}</button>
                          <button onClick={() => onCheckOut(r)} className={btnPrimary}>Check out</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-[var(--bn-admin-text)]">{search ? "Nothing matches your search." : filter === "ALL" ? "No reservations yet. Create the first one to get started." : "No reservations in this group."}</td></tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
