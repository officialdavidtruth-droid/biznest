"use client";

import { AlertTriangle, CheckCircle2, Sparkles, Wrench } from "lucide-react";
import { StatusChip, btnGhost, btnPrimary, panelCls, sameDay, shortTime, toneOf } from "@/components/dashboard/pms-ui";

type Props = { rooms: any[]; reservations: any[]; onStatus: (room: any, status: string) => void };

const COLUMNS: { id: string; title: string; hint: string; statuses: string[] }[] = [
  { id: "dirty", title: "Needs cleaning", hint: "Waiting for housekeeping", statuses: ["DIRTY"] },
  { id: "cleaning", title: "Being cleaned", hint: "In progress now", statuses: ["CLEANING"] },
  { id: "ready", title: "Ready to sell", hint: "Clean and available", statuses: ["AVAILABLE"] },
  { id: "out", title: "Maintenance", hint: "Not bookable", statuses: ["MAINTENANCE", "OUT_OF_SERVICE"] },
];

export function PmsHousekeeping({ rooms, reservations, onStatus }: Props) {
  const now = new Date();
  // A room with a guest arriving today should be cleaned first.
  const arrivingToday = new Map<string, any>();
  for (const r of reservations) if (["PENDING", "CONFIRMED"].includes(r.status) && sameDay(r.checkIn, now)) arrivingToday.set(r.roomId, r);

  const inScope = rooms.filter((r) => COLUMNS.some((c) => c.statuses.includes(r.status)));
  const dirty = rooms.filter((r) => r.status === "DIRTY");
  const urgent = dirty.filter((r) => arrivingToday.has(r.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Housekeeping</h2>
          <p className="mt-1 text-sm text-[var(--bn-admin-text)]">
            {dirty.length === 0 ? "Every room is clean." : `${dirty.length} ${dirty.length === 1 ? "room needs" : "rooms need"} cleaning`}
            {urgent > 0 && <span className="text-amber-300"> · {urgent} with a guest arriving today</span>}
          </p>
        </div>
      </div>

      {urgent > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Clean these first: a guest is due to arrive today and the room is not ready.</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = inScope
            .filter((r) => col.statuses.includes(r.status))
            .sort((a, b) => Number(arrivingToday.has(b.id)) - Number(arrivingToday.has(a.id)) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
          const tone = toneOf(col.statuses[0]);
          return (
            <section key={col.id} className={`${panelCls} flex flex-col p-4`} aria-label={col.title}>
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} /><h3 className="text-sm font-semibold">{col.title}</h3></div>
                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs tabular-nums">{items.length}</span>
              </header>
              <p className="mb-3 text-xs text-[var(--bn-admin-text)] opacity-70">{col.hint}</p>
              <div className="space-y-3">
                {items.map((r) => {
                  const arrival = arrivingToday.get(r.id);
                  return (
                    <article key={r.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><p className="truncate text-xs text-[var(--bn-admin-text)] opacity-70">{r.roomType}</p></div>
                        {r.status === "OUT_OF_SERVICE" && <StatusChip status="OUT_OF_SERVICE" />}
                      </div>
                      {arrival && col.id !== "ready" && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">Arrival today · {arrival.guest?.fullName} · {shortTime(arrival.checkIn)}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.status === "DIRTY" && <button className={btnPrimary} onClick={() => onStatus(r, "CLEANING")}><Sparkles className="mr-1 inline h-3 w-3" />Start cleaning</button>}
                        {r.status === "CLEANING" && <button className={btnPrimary} onClick={() => onStatus(r, "AVAILABLE")}><CheckCircle2 className="mr-1 inline h-3 w-3" />Mark ready</button>}
                        {r.status === "AVAILABLE" && <button className={btnGhost} onClick={() => onStatus(r, "DIRTY")}>Mark dirty</button>}
                        {["DIRTY", "CLEANING", "AVAILABLE"].includes(r.status) && <button className={btnGhost} onClick={() => onStatus(r, "MAINTENANCE")}><Wrench className="mr-1 inline h-3 w-3" />Report issue</button>}
                        {["MAINTENANCE", "OUT_OF_SERVICE"].includes(r.status) && <button className={btnPrimary} onClick={() => onStatus(r, "DIRTY")}>Fixed, needs cleaning</button>}
                      </div>
                    </article>
                  );
                })}
                {items.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-[var(--bn-admin-text)] opacity-60">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
