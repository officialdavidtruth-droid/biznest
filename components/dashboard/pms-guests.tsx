"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, Plus, Search } from "lucide-react";
import { FilterChip, StatusChip, nightsBetween, panelCls, shortDate } from "@/components/dashboard/pms-ui";

type Props = { guests: any[]; reservations: any[]; money: (n: number) => string; onAdd: () => void };

export function PmsGuests({ guests, reservations, money, onAdd }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | "INHOUSE" | "UPCOMING" | "RETURNING">("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const now = Date.now();

  const rows = useMemo(() => guests.map((g) => {
    const stays = reservations.filter((r) => r.guestId === g.id && !["CANCELLED", "NO_SHOW"].includes(r.status)).sort((a, b) => +new Date(b.checkIn) - +new Date(a.checkIn));
    const inHouse = stays.some((s) => s.status === "CHECKED_IN");
    const next = [...stays].reverse().find((s) => ["PENDING", "CONFIRMED"].includes(s.status) && +new Date(s.checkIn) >= now - 86_400_000);
    const last = stays.find((s) => s.status === "CHECKED_OUT");
    const nights = stays.reduce((n, s) => n + nightsBetween(s.checkIn, s.checkOut), 0);
    const paid = stays.filter((s) => s.paymentStatus === "PAID").reduce((n, s) => n + Number(s.depositAmount || 0), 0);
    return { g, stays, inHouse, next, last, nights, paid };
  }), [guests, reservations, now]);

  const counts = { ALL: rows.length, INHOUSE: rows.filter((r) => r.inHouse).length, UPCOMING: rows.filter((r) => r.next).length, RETURNING: rows.filter((r) => r.stays.length > 1).length };
  const shown = rows
    .filter((r) => filter === "ALL" || (filter === "INHOUSE" ? r.inHouse : filter === "UPCOMING" ? !!r.next : r.stays.length > 1))
    .filter((r) => !q.trim() || `${r.g.fullName} ${r.g.email ?? ""} ${r.g.phone ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.inHouse) - Number(a.inHouse) || String(a.g.fullName).localeCompare(String(b.g.fullName)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Guests</h2>
          <p className="mt-1 text-sm text-[var(--bn-admin-text)]">{guests.length} {guests.length === 1 ? "guest profile" : "guest profiles"} with full stay history.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm focus-within:border-emerald-400/50">
            <Search className="h-4 w-4 opacity-60" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" className="w-full min-w-0 bg-transparent outline-none placeholder:opacity-50 sm:w-60" />
          </label>
          <button onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"><Plus className="h-4 w-4" /> Add guest</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" count={counts.ALL} />
        <FilterChip active={filter === "INHOUSE"} onClick={() => setFilter("INHOUSE")} label="In-house" count={counts.INHOUSE} dot="bg-sky-400" />
        <FilterChip active={filter === "UPCOMING"} onClick={() => setFilter("UPCOMING")} label="Arriving soon" count={counts.UPCOMING} dot="bg-violet-400" />
        <FilterChip active={filter === "RETURNING"} onClick={() => setFilter("RETURNING")} label="Returning" count={counts.RETURNING} dot="bg-emerald-400" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map(({ g, stays, inHouse, next, last, nights, paid }) => {
          const open = openId === g.id;
          return (
            <article key={g.id} className={`${panelCls} p-5`}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-base font-semibold text-emerald-300">{(g.fullName || "?").trim().charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="truncate font-semibold">{g.fullName}</p>{inHouse && <StatusChip status="CHECKED_IN" />}</div>
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--bn-admin-text)] opacity-80">
                    {g.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{g.phone}</p>}
                    {g.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" /><span className="truncate">{g.email}</span></p>}
                    {!g.phone && !g.email && <p>No contact saved</p>}
                  </div>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["Stays", String(stays.length)], ["Nights", String(nights)], ["Paid", paid ? money(paid) : "-"]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-black/15 px-2 py-2.5"><dt className="text-[11px] text-[var(--bn-admin-text)] opacity-70">{k}</dt><dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>

              <p className="mt-3 text-xs text-[var(--bn-admin-text)] opacity-80">
                {inHouse ? "Staying with you now" : next ? `Next stay: ${shortDate(next.checkIn)}, ${next.room?.name}` : last ? `Last stay: ${shortDate(last.checkOut)}` : "No stays yet"}
              </p>

              {stays.length > 0 && (
                <>
                  <button onClick={() => setOpenId(open ? null : g.id)} aria-expanded={open} className="mt-3 text-xs font-medium text-emerald-300 hover:text-emerald-200">{open ? "Hide stay history" : "Show stay history"}</button>
                  {open && (
                    <ul className="mt-2 divide-y divide-white/5 rounded-xl border border-white/10">
                      {stays.slice(0, 8).map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <span className="min-w-0 truncate">{s.room?.name} · {shortDate(s.checkIn)} to {shortDate(s.checkOut)}</span>
                          <StatusChip status={s.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      {shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 py-14 text-center text-sm text-[var(--bn-admin-text)]">
          {guests.length === 0 ? "No guests yet. They are added automatically when you create a reservation, or you can add one now." : "No guests match."}
        </div>
      )}
    </div>
  );
}
