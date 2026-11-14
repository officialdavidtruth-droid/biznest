"use client";

import { useMemo, useState } from "react";
import { BedDouble, Link2, Link2Off, Plus, Wand2, Wrench, Sparkles, UserRound, CalendarClock } from "lucide-react";

const STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "DIRTY", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"] as const;

const LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  DIRTY: "Needs cleaning",
  CLEANING: "Cleaning",
  MAINTENANCE: "Maintenance",
  OUT_OF_SERVICE: "Out of service",
};

/** One distinct colour per state so the grid can be read at a glance. */
const TONE: Record<string, { dot: string; chip: string; bar: string }> = {
  AVAILABLE: { dot: "bg-emerald-400", chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25", bar: "bg-emerald-400" },
  OCCUPIED: { dot: "bg-sky-400", chip: "bg-sky-400/10 text-sky-300 border-sky-400/25", bar: "bg-sky-400" },
  RESERVED: { dot: "bg-violet-400", chip: "bg-violet-400/10 text-violet-300 border-violet-400/25", bar: "bg-violet-400" },
  DIRTY: { dot: "bg-amber-400", chip: "bg-amber-400/10 text-amber-300 border-amber-400/25", bar: "bg-amber-400" },
  CLEANING: { dot: "bg-amber-300", chip: "bg-amber-300/10 text-amber-200 border-amber-300/25", bar: "bg-amber-300" },
  MAINTENANCE: { dot: "bg-rose-400", chip: "bg-rose-400/10 text-rose-300 border-rose-400/25", bar: "bg-rose-400" },
  OUT_OF_SERVICE: { dot: "bg-rose-500", chip: "bg-rose-500/10 text-rose-300 border-rose-500/25", bar: "bg-rose-500" },
};
const tone = (s: string) => TONE[s] ?? TONE.AVAILABLE;

const fieldCls =
  "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-[var(--bn-admin-text)] outline-none transition hover:border-white/20 focus:border-emerald-400/50";

function shortDate(v: string | Date) {
  return new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

type Props = {
  rooms: any[];
  units?: any[];
  guests?: any[];
  reservations?: any[];
  onAdd: () => void;
  onStatus: (room: any, status: string) => void;
  onLink: (room: any, unitId: string) => void;
  onAutoLink: () => void;
};

export function PmsRooms({ rooms, units = [], guests = [], reservations = [], onAdd, onStatus, onLink, onAutoLink }: Props) {
  const [filter, setFilter] = useState<string>("ALL");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rooms) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rooms]);

  // The stay a room is in right now (or its next arrival), so staff can see who is where.
  const stayByRoom = useMemo(() => {
    const guestName = new Map<string, string>(guests.map((g: any) => [g.id, g.fullName]));
    const now = Date.now();
    const map = new Map<string, { guest: string; checkIn: string; checkOut: string; inHouse: boolean }>();
    const sorted = [...reservations].sort((a, b) => +new Date(a.checkIn) - +new Date(b.checkIn));
    for (const r of sorted) {
      if (!["CHECKED_IN", "CONFIRMED"].includes(r.status)) continue;
      if (+new Date(r.checkOut) < now) continue;
      const inHouse = r.status === "CHECKED_IN";
      const existing = map.get(r.roomId);
      if (existing && (existing.inHouse || !inHouse)) continue;
      map.set(r.roomId, { guest: guestName.get(r.guestId) ?? r.guest?.fullName ?? "Guest", checkIn: r.checkIn, checkOut: r.checkOut, inHouse });
    }
    return map;
  }, [guests, reservations]);

  const visible = filter === "ALL" ? rooms : rooms.filter((r) => r.status === filter);
  const linked = rooms.filter((r) => r.serviceUnitId).length;
  const taken = (unitId: string, roomId: string) => rooms.some((x) => x.id !== roomId && x.serviceUnitId === unitId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Rooms</h2>
          <p className="mt-1 text-sm text-[var(--bn-admin-text)]">
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
            {units.length > 0 && <> · {linked} linked to an online listing</>}
          </p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Add room
        </button>
      </div>

      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter rooms by status">
          <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" count={rooms.length} />
          {STATUSES.filter((s) => counts[s]).map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)} label={LABEL[s]} count={counts[s]} dot={tone(s).dot} />
          ))}
        </div>
      )}

      {units.length > 0 && linked < rooms.length && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3">
          <div className="flex items-start gap-3 text-sm text-[var(--bn-admin-text)]">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <span>{rooms.length - linked} {rooms.length - linked === 1 ? "room isn't" : "rooms aren't"} linked to an online room yet. Linked rooms block each other when one is booked.</span>
          </div>
          <button onClick={onAutoLink} className="inline-flex items-center gap-2 rounded-lg border border-sky-400/30 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-400/10">
            <Wand2 className="h-3.5 w-3.5" /> Match by name
          </button>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 py-16 text-center">
          <BedDouble className="h-8 w-8 text-[var(--bn-admin-text)] opacity-60" />
          <p className="text-sm text-[var(--bn-admin-text)]">No rooms yet. Add your first room to start taking bookings.</p>
          <button onClick={onAdd} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Add room</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center text-sm text-[var(--bn-admin-text)]">No rooms with this status.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((r) => {
            const t = tone(r.status);
            const stay = stayByRoom.get(r.id);
            const unit = units.find((u: any) => u.id === r.serviceUnitId);
            return (
              <article key={r.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]">
                <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} aria-hidden />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-semibold tracking-tight">{r.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-[var(--bn-admin-text)]">{r.roomType}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${t.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {LABEL[r.status] ?? r.status}
                  </span>
                </div>

                <div className="mt-4 min-h-[2.75rem] rounded-xl bg-black/15 px-3 py-2.5 text-xs">
                  {stay ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-medium text-[var(--bn-admin-text)]">
                        <UserRound className="h-3.5 w-3.5 opacity-70" />
                        <span className="truncate">{stay.guest}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--bn-admin-text)] opacity-70">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {stay.inHouse ? "Leaves " + shortDate(stay.checkOut) : "Arrives " + shortDate(stay.checkIn)}
                      </div>
                    </div>
                  ) : r.status === "MAINTENANCE" || r.status === "OUT_OF_SERVICE" ? (
                    <div className="flex items-center gap-2 text-[var(--bn-admin-text)] opacity-70"><Wrench className="h-3.5 w-3.5" /> Not bookable right now</div>
                  ) : r.status === "DIRTY" || r.status === "CLEANING" ? (
                    <div className="flex items-center gap-2 text-[var(--bn-admin-text)] opacity-70"><Sparkles className="h-3.5 w-3.5" /> Housekeeping in progress</div>
                  ) : (
                    <div className="flex items-center gap-2 text-[var(--bn-admin-text)] opacity-70"><BedDouble className="h-3.5 w-3.5" /> No guest assigned</div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[var(--bn-admin-text)] opacity-70">Status</span>
                    <select value={r.status} onChange={(e) => onStatus(r, e.target.value)} className={fieldCls}>
                      {STATUSES.map((s) => <option className="bg-[var(--bn-admin-page)]" key={s} value={s}>{LABEL[s]}</option>)}
                    </select>
                  </label>
                  {units.length > 0 && (
                    <label className="block">
                      <span className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--bn-admin-text)] opacity-70">
                        {unit ? <Link2 className="h-3 w-3 text-emerald-300" /> : <Link2Off className="h-3 w-3" />}
                        Online room
                      </span>
                      <select value={r.serviceUnitId || ""} onChange={(e) => onLink(r, e.target.value)} className={fieldCls}>
                        <option className="bg-[var(--bn-admin-page)]" value="">Not linked</option>
                        {units.filter((u: any) => !taken(u.id, r.id)).map((u: any) => (
                          <option className="bg-[var(--bn-admin-page)]" key={u.id} value={u.id}>{u.serviceName} · {u.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
        active ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-[var(--bn-admin-text)] hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}
