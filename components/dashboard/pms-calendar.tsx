"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelOf, panelCls, toneOf } from "@/components/dashboard/pms-ui";

const DAYS = 14;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function PmsCalendar({ rooms, reservations, channelBlocks = [] }: { rooms: any[]; reservations: any[]; channelBlocks?: any[] }) {
  const [offset, setOffset] = useState(0);
  const today = startOfDay(new Date());
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)), [offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = days[days.length - 1];
  const range = `${first.toLocaleDateString(undefined, { day: "numeric", month: "short" })} to ${last.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  // One booking per room per day, so each row is cheap to build.
  const grid = useMemo(() => {
    const map = new Map<string, { kind: "stay" | "channel"; item: any }>();
    for (const room of rooms) {
      for (const d of days) {
        const start = d.getTime();
        const end = start + 86_400_000;
        const stay = reservations.find((r) => r.roomId === room.id && !["CANCELLED", "NO_SHOW"].includes(r.status) && +new Date(r.checkIn) < end && +new Date(r.checkOut) > start);
        if (stay) { map.set(`${room.id}:${start}`, { kind: "stay", item: stay }); continue; }
        const ota = channelBlocks.find((b) => b.roomId === room.id && +new Date(b.startDate) < end && +new Date(b.endDate) > start);
        if (ota) map.set(`${room.id}:${start}`, { kind: "channel", item: ota });
      }
    }
    return map;
  }, [rooms, reservations, channelBlocks, days]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Calendar</h2>
          <p className="mt-1 text-sm text-[var(--bn-admin-text)]">{range}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 7)} aria-label="Earlier" className="rounded-lg border border-white/12 p-2 transition hover:bg-white/[0.05]"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setOffset(0)} disabled={offset === 0} className="rounded-lg border border-white/12 px-3 py-2 text-xs transition hover:bg-white/[0.05] disabled:opacity-40">Today</button>
          <button onClick={() => setOffset((o) => o + 7)} aria-label="Later" className="rounded-lg border border-white/12 p-2 transition hover:bg-white/[0.05]"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--bn-admin-text)]">
        {["CONFIRMED", "CHECKED_IN", "PENDING", "CHECKED_OUT"].map((s) => <span key={s} className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${toneOf(s).bar}`} />{labelOf(s)}</span>)}
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-fuchsia-400" />Booked online</span>
      </div>

      <div className={`${panelCls} overflow-x-auto`}>
        <div style={{ minWidth: 160 + DAYS * 84 }}>
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: `160px repeat(${DAYS}, minmax(0, 1fr))` }}>
            <div className="sticky left-0 z-10 bg-[var(--bn-admin-page)] px-4 py-3 text-xs text-[var(--bn-admin-text)]">Room</div>
            {days.map((d) => {
              const isToday = d.getTime() === today.getTime();
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={d.getTime()} className={`border-l border-white/5 px-2 py-3 text-center ${isToday ? "bg-emerald-400/10" : weekend ? "bg-white/[0.02]" : ""}`}>
                  <p className="text-[11px] text-[var(--bn-admin-text)]">{d.toLocaleDateString(undefined, { weekday: "short" })}</p>
                  <p className={`text-sm font-semibold tabular-nums ${isToday ? "text-emerald-300" : ""}`}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>

          {rooms.map((room) => (
            <div key={room.id} className="grid border-b border-white/5 last:border-0" style={{ gridTemplateColumns: `160px repeat(${DAYS}, minmax(0, 1fr))` }}>
              <div className="sticky left-0 z-10 bg-[var(--bn-admin-page)] px-4 py-3"><p className="truncate text-sm font-medium">{room.name}</p><p className="truncate text-[11px] text-[var(--bn-admin-text)]">{room.roomType}</p></div>
              {days.map((d) => {
                const cell = grid.get(`${room.id}:${d.getTime()}`);
                const isToday = d.getTime() === today.getTime();
                const base = `border-l border-white/5 p-1 ${isToday ? "bg-emerald-400/[0.05]" : ""}`;
                if (!cell) return <div key={d.getTime()} className={base}><div className="h-10" /></div>;

                if (cell.kind === "channel") {
                  const b = cell.item;
                  const startsHere = startOfDay(new Date(b.startDate)).getTime() === d.getTime() || d.getTime() === days[0].getTime();
                  return (
                    <div key={d.getTime()} className={base} title={`${b.label || String(b.provider).replace(/_/g, " ")} · booked online`}>
                      <div className="flex h-10 items-center rounded-md border border-fuchsia-400/35 bg-fuchsia-400/15 px-2 text-[11px] text-fuchsia-200">
                        {startsHere && <span className="truncate">{b.label || String(b.provider).replace(/_/g, " ")}</span>}
                      </div>
                    </div>
                  );
                }

                const r = cell.item;
                const t = toneOf(r.status);
                const startsHere = startOfDay(new Date(r.checkIn)).getTime() === d.getTime() || d.getTime() === days[0].getTime();
                return (
                  <div key={d.getTime()} className={base} title={`${r.guest?.fullName} · ${labelOf(r.status)}`}>
                    <div className={`flex h-10 items-center rounded-md border px-2 text-[11px] font-medium ${t.cell}`}>
                      {startsHere && <span className="truncate">{r.guest?.fullName}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {rooms.length === 0 && <p className="py-14 text-center text-sm text-[var(--bn-admin-text)]">Add rooms to see them on the calendar.</p>}
        </div>
      </div>
    </div>
  );
}
