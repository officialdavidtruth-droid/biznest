"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignRider, createDelivery, createRider, markDeliveryFeePaid, regenerateRiderLink, remitRiderCash, setDeliveryStatus, setRiderActive } from "@/lib/actions/dispatch";
import type { DispatchData } from "@/lib/dispatch-data";

type Result = { success: boolean; error?: string };
const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const ghost = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60";
const COLUMNS = [["NEW", "Waiting"], ["ASSIGNED", "Assigned"], ["PICKED_UP", "On the way"], ["DELIVERED", "Delivered"], ["FAILED", "Failed"]] as const;

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<Result>, ok?: string, after?: () => void) => {
    setError(""); setNote("");
    start(async () => {
      const r = await fn();
      if (!r.success) { setError(r.error ?? "Something went wrong."); return; }
      if (ok) setNote(ok);
      after?.();
      router.refresh();
    });
  };
  return { pending, error, note, run };
}
function Msg({ error, note }: { error: string; note: string }) {
  if (error) return <p role="alert" className="text-xs text-red-600">{error}</p>;
  if (note) return <p role="status" className="text-xs text-emerald-700">{note}</p>;
  return null;
}

export function DispatchWorkspace({ slug, data, riderBase, trackBase }: { slug: string; data: DispatchData; riderBase: string; trackBase: string }) {
  const [tab, setTab] = useState<"jobs" | "riders">("jobs");
  const open = data.deliveries.filter((d) => d.status === "NEW" || d.status === "ASSIGNED" || d.status === "PICKED_UP").length;
  const cash = data.riders.reduce((s, r) => s + r.cashOwed, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Open jobs", String(open)], ["Delivered", String(data.deliveries.filter((d) => d.status === "DELIVERED").length)], ["Active riders", String(data.riders.filter((r) => r.active).length)], ["Cash with riders", ngn(cash)]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className="flex gap-2" role="tablist">
        {(["jobs", "riders"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "border"}`}>{t === "jobs" ? "Deliveries" : "Riders"}</button>)}
      </div>
      {tab === "jobs" ? <JobsTab slug={slug} data={data} trackBase={trackBase} /> : <RidersTab slug={slug} data={data} riderBase={riderBase} />}
    </div>
  );
}

function JobsTab({ slug, data, trackBase }: { slug: string; data: DispatchData; trackBase: string }) {
  const a = useAction();
  const blank = { customerName: "", customerPhone: "", customerEmail: "", pickupAddress: "", dropoffAddress: "", itemDescription: "", fee: "", codAmount: "", riderId: "" };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const riders = data.riders.filter((r) => r.active);
  return (
    <div className="space-y-4">
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run(() => createDelivery(slug, { ...f, fee: Number(f.fee || 0), codAmount: Number(f.codAmount || 0), riderId: f.riderId || undefined }), "Job booked.", () => setF(blank)); }}>
        <input className={input} placeholder="Customer name" aria-label="Customer name" value={f.customerName} onChange={set("customerName")} />
        <input className={input} placeholder="Customer phone" aria-label="Customer phone" value={f.customerPhone} onChange={set("customerPhone")} />
        <input className={input} placeholder="Customer email (for tracking link)" aria-label="Customer email" value={f.customerEmail} onChange={set("customerEmail")} />
        <input className={input} placeholder="Item, e.g. 2 boxes of shoes" aria-label="Item" value={f.itemDescription} onChange={set("itemDescription")} />
        <input className={input} placeholder="Pickup address" aria-label="Pickup address" value={f.pickupAddress} onChange={set("pickupAddress")} />
        <input className={input} placeholder="Delivery address" aria-label="Delivery address" value={f.dropoffAddress} onChange={set("dropoffAddress")} />
        <input className={input} type="number" min="0" placeholder="Delivery fee" aria-label="Delivery fee" value={f.fee} onChange={set("fee")} />
        <input className={input} type="number" min="0" placeholder="Cash to collect (optional)" aria-label="Cash on delivery" value={f.codAmount} onChange={set("codAmount")} />
        <select className={input} value={f.riderId} onChange={set("riderId")} aria-label="Rider"><option value="">Assign later</option>{riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <button className={btn} disabled={a.pending}>Book delivery</button>
        <div className="md:col-span-4"><Msg error={a.error} note={a.note} /></div>
      </form>
      <div className="grid gap-4 lg:grid-cols-5">
        {COLUMNS.map(([status, title]) => {
          const list = data.deliveries.filter((d) => d.status === status).slice(0, status === "DELIVERED" ? 15 : 50);
          return (
            <div key={status} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title} ({data.deliveries.filter((d) => d.status === status).length})</p>
              {list.map((d) => <JobCard key={d.id} slug={slug} d={d} riders={riders} trackBase={trackBase} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ slug, d, riders, trackBase }: { slug: string; d: DispatchData["deliveries"][number]; riders: DispatchData["riders"]; trackBase: string }) {
  const a = useAction();
  return (
    <div className="rounded-xl border bg-card p-3 text-xs">
      <div className="flex justify-between gap-2"><b>{d.jobNo}</b><span className="text-muted-foreground">{d.riderName ?? "No rider"}</span></div>
      <p className="mt-1 font-semibold">{d.customerName}</p>
      <p className="text-muted-foreground">{d.pickupAddress} → {d.dropoffAddress}</p>
      {d.itemDescription && <p className="text-muted-foreground">{d.itemDescription}</p>}
      <p className="mt-1">{ngn(d.fee)} fee{d.feePaid ? " (paid)" : ""}{d.codAmount > 0 ? ` · collect ${ngn(d.codAmount)}${d.codRemittedAt ? " (handed in)" : ""}` : ""}</p>
      {d.failureReason && <p className="mt-1 text-red-600">{d.failureReason}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {(d.status === "NEW" || d.status === "ASSIGNED") && (
          <select className="rounded border bg-background px-1 py-1" aria-label="Assign rider" value={d.riderId ?? ""} disabled={a.pending} onChange={(e) => e.target.value && a.run(() => assignRider(slug, d.id, e.target.value))}>
            <option value="">{d.riderId ? "Change rider" : "Assign rider"}</option>{riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <button className={ghost} onClick={() => navigator.clipboard?.writeText(`${trackBase}${d.trackToken}`)}>Copy tracking link</button>
        {!d.feePaid && d.status !== "CANCELLED" && <button className={ghost} disabled={a.pending} onClick={() => a.run(() => markDeliveryFeePaid(slug, d.id, true))}>Fee paid</button>}
        {d.status === "FAILED" && <button className={ghost} disabled={a.pending} onClick={() => a.run(() => setDeliveryStatus(slug, d.id, "NEW"))}>Send again</button>}
        {(d.status === "NEW" || d.status === "ASSIGNED") && <button className={ghost} disabled={a.pending} onClick={() => confirm("Cancel this delivery?") && a.run(() => setDeliveryStatus(slug, d.id, "CANCELLED"))}>Cancel</button>}
      </div>
      <Msg error={a.error} note={a.note} />
      <span className="sr-only">{riders.length}</span>
    </div>
  );
}

function RidersTab({ slug, data, riderBase }: { slug: string; data: DispatchData; riderBase: string }) {
  const a = useAction();
  const [f, setF] = useState({ name: "", phone: "", vehicle: "" });
  const [links, setLinks] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4">
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run(() => createRider(slug, f), "Rider added. Copy their link and send it to them.", () => setF({ name: "", phone: "", vehicle: "" })); }}>
        <input className={input} placeholder="Rider name" aria-label="Rider name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={input} placeholder="Phone" aria-label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input className={input} placeholder="Vehicle, e.g. Bike" aria-label="Vehicle" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} />
        <button className={btn} disabled={a.pending}>Add rider</button>
        <div className="md:col-span-4"><Msg error={a.error} note={a.note} /></div>
      </form>
      <ul className="space-y-2">
        {data.riders.map((r) => {
          const link = `${riderBase}${links[r.id] ?? r.accessToken}`;
          return (
            <li key={r.id} className={`rounded-xl border bg-card p-4 text-sm ${r.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><b>{r.name}</b> <span className="text-xs text-muted-foreground">{[r.vehicle, r.phone].filter(Boolean).join(" · ")} · {r.open} in progress</span></span>
                <span className="flex flex-wrap gap-2">
                  {r.cashOwed > 0 && <button className={btn} disabled={a.pending} onClick={() => confirm(`Mark ${ngn(r.cashOwed)} from ${r.cashJobs} job(s) as handed in?`) && a.run(() => remitRiderCash(slug, r.id), "Cash recorded as handed in.")}>Cash held {ngn(r.cashOwed)}: mark handed in</button>}
                  <button className={ghost} onClick={() => navigator.clipboard?.writeText(link)}>Copy rider link</button>
                  <button className={ghost} disabled={a.pending} onClick={() => confirm("The old link stops working. Continue?") && a.run(async () => { const x = await regenerateRiderLink(slug, r.id); if (x.success) setLinks({ ...links, [r.id]: x.data.accessToken }); return x; }, "New link created.")}>New link</button>
                  <button className={ghost} disabled={a.pending} onClick={() => a.run(() => setRiderActive(slug, r.id, !r.active))}>{r.active ? "Deactivate" : "Reactivate"}</button>
                </span>
              </div>
            </li>
          );
        })}
        {data.riders.length === 0 && <p className="text-sm text-muted-foreground">No riders yet.</p>}
      </ul>
    </div>
  );
}
