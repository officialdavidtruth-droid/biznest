"use client";

import { Activity, ArrowRight, BedDouble, DoorOpen, LogOut, Plus, Sparkles, WalletCards } from "lucide-react";
import { StatusChip, panelCls, shortDate, shortTime, sameDay, toneOf, labelOf } from "@/components/dashboard/pms-ui";


const BAR_ORDER = ["OCCUPIED", "RESERVED", "AVAILABLE", "DIRTY", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type Props = {
  stats: { occupancy: number; occupied: number; sellable: number; arrivals: number; departures: number };
  rooms: any[];
  reservations: any[];
  setTab: (tab: any) => void;
};

export function PmsDashboard({ stats, rooms, reservations, setTab }: Props) {
  const counts: Record<string, number> = {};
  for (const r of rooms) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const now = new Date();

  const arrivals = reservations.filter((r) => ["PENDING", "CONFIRMED"].includes(r.status) && sameDay(r.checkIn, now));
  const departures = reservations.filter((r) => r.status === "CHECKED_IN" && sameDay(r.checkOut, now));
  const inHouse = reservations.filter((r) => r.status === "CHECKED_IN").length;
  const needsCleaning = (counts.DIRTY ?? 0) + (counts.CLEANING ?? 0);
  const unpaid = reservations.filter((r) => r.paymentStatus !== "PAID" && !["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(r.status)).length;
  const upcoming = [...reservations]
    .filter((r) => ["PENDING", "CONFIRMED"].includes(r.status) && +new Date(r.checkIn) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())
    .sort((a, b) => +new Date(a.checkIn) - +new Date(b.checkIn))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-emerald-300">{greeting()}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Today at the property</h2>
          <p className="mt-1.5 text-sm text-[var(--bn-admin-text)]">
            {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · {inHouse} {inHouse === 1 ? "guest" : "guests"} in-house
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("reservations")} className="rounded-xl border border-white/12 px-4 py-2.5 text-sm text-[var(--bn-admin-text)] transition hover:bg-white/[0.05]">All reservations</button>
          <button onClick={() => setTab("frontdesk")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400">
            <DoorOpen className="h-4 w-4" /> Front desk
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${panelCls} relative overflow-hidden p-5`}>
          <div className="flex items-center justify-between text-sm text-[var(--bn-admin-text)]"><span>Occupancy</span><Activity className="h-4 w-4 opacity-60" /></div>
          <p className="mt-4 text-4xl font-semibold tabular-nums">{stats.occupancy}<span className="text-xl text-[var(--bn-admin-text)]">%</span></p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.min(100, stats.occupancy)}%` }} /></div>
          <p className="mt-2 text-xs text-[var(--bn-admin-text)]">{stats.occupied} of {stats.sellable} sellable rooms</p>
        </div>
        <Stat label="Arrivals today" value={arrivals.length} sub={arrivals.length ? "Waiting to check in" : "None expected"} icon={DoorOpen} accent="text-violet-300" onClick={() => setTab("frontdesk")} />
        <Stat label="Departures today" value={departures.length} sub={departures.length ? "Still to check out" : "None expected"} icon={LogOut} accent="text-sky-300" onClick={() => setTab("frontdesk")} />
        <Stat label="Rooms to clean" value={needsCleaning} sub={needsCleaning ? "Dirty or being cleaned" : "All rooms ready"} icon={Sparkles} accent="text-amber-300" onClick={() => setTab("housekeeping")} />
      </div>

      <div className={`${panelCls} p-5`}>
        <div className="flex items-center justify-between">
          <div><h3 className="font-semibold">Room status</h3><p className="mt-0.5 text-xs text-[var(--bn-admin-text)]">{rooms.length} rooms</p></div>
          <button onClick={() => setTab("rooms")} className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200">Manage rooms <ArrowRight className="h-3 w-3" /></button>
        </div>
        {rooms.length > 0 && (
          <>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label="Rooms by status">
              {BAR_ORDER.filter((s) => counts[s]).map((s) => <div key={s} className={toneOf(s).bar} style={{ width: `${(counts[s] / rooms.length) * 100}%` }} title={`${labelOf(s)}: ${counts[s]}`} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--bn-admin-text)]">
              {BAR_ORDER.filter((s) => counts[s]).map((s) => <span key={s} className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${toneOf(s).dot}`} />{labelOf(s)} <b className="tabular-nums text-white/90">{counts[s]}</b></span>)}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <List title="Arriving today" empty="No arrivals today" items={arrivals} time={(r) => shortTime(r.checkIn)} onOpen={() => setTab("frontdesk")} />
        <List title="Leaving today" empty="No departures today" items={departures} time={(r) => shortTime(r.checkOut)} onOpen={() => setTab("frontdesk")} />
      </div>

      <div className={`${panelCls} p-5`}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">Next arrivals</h3><button onClick={() => setTab("calendar")} className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200">Open calendar <ArrowRight className="h-3 w-3" /></button></div>
        <div className="mt-3 divide-y divide-white/5">
          {upcoming.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{r.guest?.fullName}</p><p className="text-xs text-[var(--bn-admin-text)]">{r.room?.name} · {shortDate(r.checkIn)} to {shortDate(r.checkOut)}</p></div>
              <StatusChip status={r.status} />
            </div>
          ))}
          {upcoming.length === 0 && <p className="py-8 text-center text-sm text-[var(--bn-admin-text)]">No upcoming arrivals. New bookings will show up here.</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Quick icon={Plus} label="New reservation" text="Book a stay for a guest" onClick={() => setTab("reservations")} />
        <Quick icon={Sparkles} label="Housekeeping" text={needsCleaning ? `${needsCleaning} to clean` : "Everything is ready"} onClick={() => setTab("housekeeping")} />
        <Quick icon={WalletCards} label="Billing" text={unpaid ? `${unpaid} unpaid ${unpaid === 1 ? "stay" : "stays"}` : "Nothing outstanding"} onClick={() => setTab("billing")} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon: Icon, accent, onClick }: { label: string; value: number; sub: string; icon: any; accent: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${panelCls} p-5 text-left transition hover:border-white/20 hover:bg-white/[0.05]`}>
      <div className="flex items-center justify-between text-sm text-[var(--bn-admin-text)]"><span>{label}</span><Icon className={`h-4 w-4 ${accent}`} /></div>
      <p className="mt-4 text-4xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-[var(--bn-admin-text)]">{sub}</p>
    </button>
  );
}

function List({ title, items, empty, time, onOpen }: { title: string; items: any[]; empty: string; time: (r: any) => string; onOpen: () => void }) {
  return (
    <div className={`${panelCls} p-5`}>
      <div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3><span className="text-xs tabular-nums text-[var(--bn-admin-text)]">{items.length}</span></div>
      <div className="mt-3 divide-y divide-white/5">
        {items.slice(0, 6).map((r) => (
          <button key={r.id} onClick={onOpen} className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:opacity-80">
            <div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]"><BedDouble className="h-4 w-4 opacity-70" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{r.guest?.fullName}</p><p className="text-xs text-[var(--bn-admin-text)]">{r.room?.name}</p></div></div>
            <span className="text-xs tabular-nums text-[var(--bn-admin-text)]">{time(r)}</span>
          </button>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-sm text-[var(--bn-admin-text)]">{empty}</p>}
      </div>
    </div>
  );
}

function Quick({ icon: Icon, label, text, onClick }: { icon: any; label: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${panelCls} group flex items-center gap-4 p-4 text-left transition hover:border-white/20 hover:bg-white/[0.05]`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-[var(--bn-admin-text)]">{text}</span></span>
      <ArrowRight className="h-4 w-4 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
    </button>
  );
}
