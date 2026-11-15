"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Fuel, Gauge, Plus, Truck, Wallet, Wrench, X } from "lucide-react";
import { addFleetLog, deleteFleetLog, deleteFleetVehicle, saveFleetVehicle, type FleetLogView, type FleetVehicleView } from "@/lib/actions/fleet";
import { currencySymbol } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";

type Props = { slug: string; vehicles: FleetVehicleView[]; logs: FleetLogView[]; fuel30: number; cost30: number; costPerKm: number | null };
const TYPES: [string, string][] = [["FUEL", "Fuel"], ["SERVICE", "Service"], ["REPAIR", "Repair"], ["INSURANCE", "Insurance"], ["OTHER", "Other"]];
const STATUS_TONE: Record<string, string> = { ACTIVE: "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]", IN_SERVICE: "bg-amber-100 text-amber-800", RETIRED: "bg-muted text-muted-foreground" };
const day = 86_400_000;
const inputCls = "rounded-lg border bg-background px-3 py-2 text-sm font-normal";
const money = (n: number) => `${currencySymbol()}${Math.round(n).toLocaleString()}`;

function alertsFor(v: FleetVehicleView) {
  const out: { text: string; level: "late" | "soon" }[] = [];
  const now = Date.now();
  if (v.nextServiceKm != null) {
    const left = v.nextServiceKm - v.odometer;
    if (left <= 0) out.push({ text: `Service overdue by ${Math.abs(left).toLocaleString()} km`, level: "late" });
    else if (left <= 500) out.push({ text: `Service due in ${left.toLocaleString()} km`, level: "soon" });
  }
  if (v.nextServiceDate) {
    const d = Math.ceil((+new Date(v.nextServiceDate) - now) / day);
    if (d < 0) out.push({ text: `Service date passed ${-d} day${d === -1 ? "" : "s"} ago`, level: "late" });
    else if (d <= 14) out.push({ text: `Service due in ${d} day${d === 1 ? "" : "s"}`, level: "soon" });
  }
  if (v.insuranceExpiry) {
    const d = Math.ceil((+new Date(v.insuranceExpiry) - now) / day);
    if (d < 0) out.push({ text: "Insurance expired", level: "late" });
    else if (d <= 30) out.push({ text: `Insurance expires in ${d} day${d === 1 ? "" : "s"}`, level: "soon" });
  }
  return out;
}

export function FleetWorkspace({ slug, vehicles, logs, fuel30, cost30, costPerKm }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<FleetVehicleView | "new" | null>(null);
  const [logging, setLogging] = useState<FleetVehicleView | null>(null);
  const [logType, setLogType] = useState("FUEL");
  const [filter, setFilter] = useState<"ALL" | "ALERTS">("ALL");

  const withAlerts = useMemo(() => vehicles.map((v) => ({ v, alerts: v.status === "RETIRED" ? [] : alertsFor(v) })), [vehicles]);
  const alertCount = withAlerts.filter((x) => x.alerts.length).length;
  const shown = withAlerts.filter((x) => filter === "ALL" || x.alerts.length);
  const active = vehicles.filter((v) => v.status === "ACTIVE").length;

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, done?: () => void) =>
    start(async () => { const r = await fn(); if (r.success) { done?.(); location.reload(); } else setMsg(r.error ?? "Something went wrong."); });

  function saveVehicle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    const str = (k: string) => String(f.get(k) ?? "");
    const target = editing && editing !== "new" ? editing.id : undefined;
    run(() => saveFleetVehicle(slug, { registration: str("registration"), name: str("name"), make: str("make"), model: str("model"), year: num("year"), driverName: str("driverName"), status: str("status"), odometer: num("odometer"), nextServiceKm: num("nextServiceKm") ?? null, nextServiceDate: str("nextServiceDate") || null, insuranceExpiry: str("insuranceExpiry") || null, notes: str("notes") }, target) as any);
  }
  function saveLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!logging) return;
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    run(() => addFleetLog(slug, { vehicleId: logging.id, type: logType, loggedAt: String(f.get("loggedAt") || "") || undefined, odometer: num("odometer"), litres: num("litres"), cost: num("cost"), notes: String(f.get("notes") ?? "") }) as any);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest Operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Fleet management</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Track every vehicle, log fuel, service and repairs, and get warned before a service or insurance renewal is due.</p>
        </div>
        <button onClick={() => { setMsg(""); setEditing("new"); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" />Add vehicle</button>
      </div>

      {msg && <div className="flex items-center justify-between rounded-xl border border-[var(--bn-admin-danger-line)] bg-[var(--bn-admin-danger-soft)] p-3 text-sm text-[var(--bn-admin-danger)]"><span>{msg}</span><button onClick={() => setMsg("")} aria-label="Dismiss"><X className="h-4 w-4" /></button></div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Vehicles", v: String(vehicles.length), s: `${active} active`, I: Truck },
          { l: "Needs attention", v: String(alertCount), s: alertCount ? "Service or insurance due" : "Nothing due", I: AlertTriangle },
          { l: "Fuel (30 days)", v: money(fuel30), s: "Spent on fuel", I: Fuel },
          { l: "Running cost (30 days)", v: money(cost30), s: costPerKm != null ? `${currencySymbol()}${costPerKm} per km` : "Log mileage to see cost per km", I: Wallet },
        ].map(({ l, v, s, I }) => (
          <div key={l} className="rounded-2xl border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{l}</span><I className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{v}</p><p className="mt-1 text-[11px] text-muted-foreground">{s}</p></div>
        ))}
      </div>

      <div className="flex gap-2">
        {([["ALL", `All vehicles (${vehicles.length})`], ["ALERTS", `Needs attention (${alertCount})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${filter === id ? "bg-primary text-primary-foreground" : "bg-background"}`}>{label}</button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {shown.map(({ v, alerts }) => (
          <article key={v.id} className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-bold">{v.registration}</p><p className="truncate text-xs text-muted-foreground">{[v.year, v.make, v.model].filter(Boolean).join(" ") || v.name || "No details"}{v.driverName ? ` · ${v.driverName}` : ""}</p></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_TONE[v.status] ?? "bg-muted"}`}>{v.status.replace("_", " ")}</span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[["Odometer", `${v.odometer.toLocaleString()} km`], ["30-day cost", money(v.cost30)], ["Fuel economy", v.kmPerLitre ? `${v.kmPerLitre} km/L` : "-"]].map(([k, val]) => (
                <div key={k} className="rounded-xl bg-muted/40 px-2 py-2.5"><dt className="text-[10px] text-muted-foreground">{k}</dt><dd className="mt-0.5 truncate text-sm font-bold">{val}</dd></div>
              ))}
            </dl>
            {alerts.length > 0 && <ul className="mt-3 space-y-1.5">{alerts.map((a) => <li key={a.text} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium ${a.level === "late" ? "bg-[var(--bn-admin-danger-soft)] text-[var(--bn-admin-danger)]" : "bg-amber-50 text-amber-800"}`}><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{a.text}</li>)}</ul>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => { setMsg(""); setLogType("FUEL"); setLogging(v); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Gauge className="h-3 w-3" />Log entry</button>
              <button onClick={() => { setMsg(""); setEditing(v); }} className="rounded-lg border px-3 py-2 text-xs font-bold">Edit</button>
              <button disabled={pending} onClick={() => { if (confirm(`Delete ${v.registration} and all its logs?`)) run(() => deleteFleetVehicle(slug, v.id) as any); }} className="rounded-lg border px-3 py-2 text-xs font-bold text-muted-foreground">Delete</button>
            </div>
          </article>
        ))}
      </section>
      {shown.length === 0 && (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center"><Truck className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">{vehicles.length ? "Nothing needs attention" : "No vehicles yet"}</p><p className="mt-1 text-xs text-muted-foreground">{vehicles.length ? "Every vehicle is up to date." : "Add your first vehicle to start tracking fuel, service and costs."}</p></div>
      )}

      {logs.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="border-b px-5 py-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Wrench className="h-4 w-4 text-primary" />Recent entries</h2></div>
          <div className="divide-y">
            {logs.slice(0, 20).map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0"><p className="font-medium">{l.registration} · {TYPES.find(([id]) => id === l.type)?.[1] ?? l.type}{l.litres ? ` · ${l.litres} L` : ""}</p><p className="text-xs text-muted-foreground">{formatDate(new Date(l.loggedAt))}{l.odometer ? ` · ${l.odometer.toLocaleString()} km` : ""}{l.notes ? ` · ${l.notes}` : ""}</p></div>
                <div className="flex items-center gap-3"><b>{money(l.cost)}</b><button aria-label="Delete entry" disabled={pending} onClick={() => { if (confirm("Delete this entry?")) run(() => deleteFleetLog(slug, l.id) as any); }} className="text-muted-foreground"><X className="h-4 w-4" /></button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add vehicle" : `Edit ${editing.registration}`} onClose={() => setEditing(null)}>
          <form onSubmit={saveVehicle} className="grid gap-3">
            {(() => { const e = editing === "new" ? null : editing; const d = (iso?: string | null) => (iso ? iso.slice(0, 10) : ""); return (<>
              <Field label="Registration number"><input name="registration" required defaultValue={e?.registration} className={inputCls} placeholder="ABC-123-XY" /></Field>
              <div className="grid grid-cols-3 gap-3"><Field label="Make"><input name="make" defaultValue={e?.make ?? ""} className={inputCls} /></Field><Field label="Model"><input name="model" defaultValue={e?.model ?? ""} className={inputCls} /></Field><Field label="Year"><input name="year" type="number" defaultValue={e?.year ?? ""} className={inputCls} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Driver"><input name="driverName" defaultValue={e?.driverName ?? ""} className={inputCls} /></Field><Field label="Status"><select name="status" defaultValue={e?.status ?? "ACTIVE"} className={inputCls}><option value="ACTIVE">Active</option><option value="IN_SERVICE">In service</option><option value="RETIRED">Retired</option></select></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Odometer (km)"><input name="odometer" type="number" min="0" defaultValue={e?.odometer ?? 0} className={inputCls} /></Field><Field label="Next service at (km)"><input name="nextServiceKm" type="number" min="0" defaultValue={e?.nextServiceKm ?? ""} className={inputCls} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Next service date"><input name="nextServiceDate" type="date" defaultValue={d(e?.nextServiceDate)} className={inputCls} /></Field><Field label="Insurance expires"><input name="insuranceExpiry" type="date" defaultValue={d(e?.insuranceExpiry)} className={inputCls} /></Field></div>
              <Field label="Notes"><textarea name="notes" rows={2} defaultValue={e?.notes ?? ""} className={inputCls} /></Field>
            </>); })()}
            <button type="submit" disabled={pending} className="rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground">{pending ? "Saving…" : "Save vehicle"}</button>
          </form>
        </Modal>
      )}

      {logging && (
        <Modal title={`Log entry for ${logging.registration}`} onClose={() => setLogging(null)}>
          <form onSubmit={saveLog} className="grid gap-3">
            <div className="flex flex-wrap gap-2">{TYPES.map(([id, label]) => <button type="button" key={id} onClick={() => setLogType(id)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${logType === id ? "bg-primary text-primary-foreground" : ""}`}>{label}</button>)}</div>
            <div className="grid grid-cols-2 gap-3"><Field label="Date"><input name="loggedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} /></Field><Field label="Odometer (km)"><input name="odometer" type="number" min="0" defaultValue={logging.odometer || ""} className={inputCls} /></Field></div>
            <div className="grid grid-cols-2 gap-3">{logType === "FUEL" && <Field label="Litres"><input name="litres" type="number" step="0.01" min="0" required className={inputCls} /></Field>}<Field label={`Cost (${currencySymbol()})`}><input name="cost" type="number" step="0.01" min="0" className={inputCls} /></Field></div>
            <Field label="Notes"><input name="notes" className={inputCls} placeholder={logType === "SERVICE" ? "Oil change, filters" : ""} /></Field>
            {logType === "SERVICE" && <p className="text-[11px] text-muted-foreground">After a service, edit the vehicle to set the next service km and date.</p>}
            <button type="submit" disabled={pending} className="rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground">{pending ? "Saving…" : "Save entry"}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4"><div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-background shadow-xl"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="Close"><X /></button></div><div className="overflow-y-auto px-5 py-4">{children}</div></div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-medium">{label}{children}</label>;
}
