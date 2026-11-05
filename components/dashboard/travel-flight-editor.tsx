"use client";

import { type ReactNode } from "react";
import { emptyFlight, flightSummary, ticketingState, ticketsIssued, type Flight } from "@/lib/travel-flight";

const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn2 = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block text-xs text-muted-foreground ${className}`}>{label}<div className="mt-1">{children}</div></label>;
}

/** ISO instant → value for a datetime-local input, in the browser's time zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** datetime-local value → ISO instant, or "" when empty. */
export function fromLocalInput(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export type FlightDraft = { flight: Flight; ticketingDeadline: string }; // deadline as a datetime-local value
export const emptyDraft = (): FlightDraft => ({ flight: emptyFlight(), ticketingDeadline: "" });
export const draftFrom = (flight: Flight | null, deadlineIso: string | null): FlightDraft => ({ flight: flight ?? emptyFlight(), ticketingDeadline: toLocalInput(deadlineIso) });

export function FlightFields({ draft, setDraft, travellerNames }: { draft: FlightDraft; setDraft: (d: FlightDraft) => void; travellerNames: string[] }) {
  const f = draft.flight;
  const set = (patch: Partial<Flight>) => setDraft({ ...draft, flight: { ...f, ...patch } });
  // One ticket row per traveller, in the order they were added; extra rows already typed are kept.
  const rows = [...f.tickets];
  for (const n of travellerNames) if (!rows.some((t) => t.name === n)) rows.push({ name: n, number: "" });
  const setTicket = (name: string, number: string, index: number) => set({ tickets: rows.map((t, i) => (i === index ? { name, number } : t)) });
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 md:grid-cols-6">
      <Field label="Airline" className="md:col-span-2"><input className={inp} value={f.airline} onChange={(e) => set({ airline: e.target.value })} placeholder="Emirates" /></Field>
      <Field label="Flight no."><input className={inp} value={f.flightNumber} onChange={(e) => set({ flightNumber: e.target.value })} placeholder="EK783" /></Field>
      <Field label="From (airport)"><input className={inp} maxLength={3} value={f.origin} onChange={(e) => set({ origin: e.target.value.toUpperCase() })} placeholder="LOS" /></Field>
      <Field label="To (airport)"><input className={inp} maxLength={3} value={f.destination} onChange={(e) => set({ destination: e.target.value.toUpperCase() })} placeholder="DXB" /></Field>
      <Field label="Booking ref (PNR)"><input className={inp} maxLength={8} value={f.pnr} onChange={(e) => set({ pnr: e.target.value.toUpperCase() })} placeholder="X7K2PQ" /></Field>
      <Field label="Departs (local time)" className="md:col-span-3"><input type="datetime-local" className={inp} value={f.departAt} onChange={(e) => set({ departAt: e.target.value })} /></Field>
      <Field label="Arrives (local time)" className="md:col-span-3"><input type="datetime-local" className={inp} value={f.arriveAt} onChange={(e) => set({ arriveAt: e.target.value })} /></Field>
      <Field label="Class" className="md:col-span-2"><input className={inp} value={f.cabin} onChange={(e) => set({ cabin: e.target.value })} placeholder="Economy" /></Field>
      <Field label="Baggage" className="md:col-span-4"><input className={inp} value={f.baggage} onChange={(e) => set({ baggage: e.target.value })} placeholder="1 x 23kg checked, 7kg cabin" /></Field>
      <div className="md:col-span-6">
        <div className="text-xs text-muted-foreground">Ticket numbers (one per traveller, 13 digits)</div>
        {rows.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Add travellers to the trip to enter a ticket for each, or type a ticket below.</p>}
        <div className="mt-1 grid gap-2 md:grid-cols-2">
          {rows.map((t, i) => (
            <div key={`${t.name}-${i}`} className="flex items-center gap-2">
              <input className={`${inp} max-w-[45%]`} value={t.name} placeholder="Traveller" onChange={(e) => setTicket(e.target.value, t.number, i)} />
              <input className={inp} inputMode="numeric" value={t.number} placeholder="176-1234567890" onChange={(e) => setTicket(t.name, e.target.value, i)} />
            </div>
          ))}
        </div>
        <button type="button" className={`${btn2} mt-2`} onClick={() => set({ tickets: [...rows, { name: "", number: "" }] })}>Add a ticket</button>
      </div>
      <Field label="Ticketing deadline (the airline's time limit to issue tickets)" className="md:col-span-6"><input type="datetime-local" className={inp} value={draft.ticketingDeadline} onChange={(e) => setDraft({ ...draft, ticketingDeadline: e.target.value })} /></Field>
    </div>
  );
}

/** What gets sent to saveTravelItem. Blank ticket rows are dropped by the server. */
export function draftPayload(d: FlightDraft): { flight: Flight; ticketingDeadline: string | null } {
  return { flight: d.flight, ticketingDeadline: fromLocalInput(d.ticketingDeadline) || null };
}

/** The flight summary and ticketing status shown under a service line. */
export function FlightLine({ flight, deadline, travellerCount }: { flight: Flight | null; deadline: string | null; travellerCount: number }) {
  if (!flight && !deadline) return null;
  const issued = ticketsIssued(flight, travellerCount);
  const state = ticketingState(deadline ? new Date(deadline) : null, issued);
  const when = deadline ? new Date(deadline).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="mt-1 space-y-0.5 text-xs">
      {flight && <div className="text-foreground/80">{flightSummary(flight)}</div>}
      {flight && (flight.pnr || flight.tickets.length > 0) && (
        <div className="text-muted-foreground">{flight.pnr ? `PNR ${flight.pnr}` : ""}{flight.pnr && flight.tickets.length ? " · " : ""}{flight.tickets.length ? `${flight.tickets.length} ticket${flight.tickets.length === 1 ? "" : "s"} issued${travellerCount ? ` of ${travellerCount} travellers` : ""}` : ""}</div>
      )}
      {deadline && state && (
        <div className={state === "overdue" ? "font-semibold text-red-600" : state === "soon" ? "font-semibold text-amber-600" : "text-muted-foreground"}>
          {state === "overdue" ? "Ticketing deadline passed: " : "Ticket by "}{when}
        </div>
      )}
      {deadline && !state && issued && <div className="text-emerald-600">All tickets issued</div>}
    </div>
  );
}
