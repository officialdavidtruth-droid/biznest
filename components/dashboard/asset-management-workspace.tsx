"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Plus, Trash2, Wrench } from "lucide-react";
import { addAsset, addMaintenanceNote, deleteAsset, depreciateAsset, disposeAsset, type AssetRow } from "@/lib/actions/asset-management";
import { moneyFormatter } from "@/lib/utils/format-money";

const CATEGORIES = ["Equipment", "Vehicle", "Property", "Furniture", "IT & electronics", "Machinery", "Other"];
type Filter = "all" | "ACTIVE" | "FULLY_DEPRECIATED" | "DISPOSED";
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", FULLY_DEPRECIATED: "Fully depreciated", DISPOSED: "Disposed" };
const STATUS_STYLE: Record<string, string> = { ACTIVE: "bg-emerald-100 text-emerald-700", FULLY_DEPRECIATED: "bg-amber-100 text-amber-800", DISPOSED: "bg-muted text-muted-foreground" };

function monthsBetween(from: Date, to: Date) {
  return Math.max(0, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) - (to.getUTCDate() < from.getUTCDate() ? 1 : 0));
}

function calc(a: AssetRow) {
  const depreciable = a.purchaseCost - a.residualValue;
  const monthly = depreciable / a.usefulLifeMonths;
  const nbv = a.purchaseCost - a.accumulatedDepreciation;
  const pct = depreciable > 0 ? Math.min(100, Math.round((a.accumulatedDepreciation / depreciable) * 100)) : 100;
  const recorded = monthly > 0 ? Math.round(a.accumulatedDepreciation / monthly) : 0;
  const elapsed = Math.min(a.usefulLifeMonths, monthsBetween(new Date(a.purchaseDate), new Date()));
  const behind = a.status === "ACTIVE" ? Math.max(0, Math.min(elapsed - recorded, a.usefulLifeMonths - recorded)) : 0;
  return { monthly, nbv, pct, behind };
}

export function AssetManagementWorkspace({ slug, data }: { slug: string; data: { currency: string; locale: string | null; assets: AssetRow[] } }) {
  const router = useRouter();
  const money = useMemo(() => moneyFormatter({ currency: data.currency, locale: data.locale }), [data.currency, data.locale]);
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(data.assets.length === 0);
  const [form, setForm] = useState({ name: "", category: CATEGORIES[0], purchaseDate: new Date().toISOString().slice(0, 10), purchaseCost: "", usefulLifeMonths: "36", residualValue: "", notes: "" });
  const [logFor, setLogFor] = useState<string | null>(null);
  const [logText, setLogText] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => data.assets.map((a) => ({ a, ...calc(a) })), [data.assets]);
  const live = rows.filter((r) => r.a.status !== "DISPOSED");
  const totals = {
    count: live.length,
    cost: live.reduce((s, r) => s + r.a.purchaseCost, 0),
    nbv: live.reduce((s, r) => s + r.nbv, 0),
    dep: live.reduce((s, r) => s + r.a.accumulatedDepreciation, 0),
  };
  const dueCount = rows.filter((r) => r.behind > 0).length;
  const visible = rows.filter((r) => (filter === "all" || r.a.status === filter) && (!q.trim() || `${r.a.name} ${r.a.assetNo} ${r.a.category}`.toLowerCase().includes(q.trim().toLowerCase())));

  const field = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm";
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.success) toast.error(r.error ?? "Something went wrong.");
      else { toast.success(ok); after?.(); router.refresh(); }
    });

  const save = () => run(() => addAsset(slug, { name: form.name, category: form.category, purchaseDate: form.purchaseDate, purchaseCost: Number(form.purchaseCost), usefulLifeMonths: Number(form.usefulLifeMonths), residualValue: form.residualValue ? Number(form.residualValue) : 0, notes: form.notes }), "Asset added", () => { setForm({ ...form, name: "", purchaseCost: "", residualValue: "", notes: "" }); setShowForm(false); });

  const cards: [string, string][] = [["Assets", String(totals.count)], ["Total cost", money(totals.cost)], ["Net book value", money(totals.nbv)], ["Depreciation to date", money(totals.dep)]];
  const chips: [Filter, string][] = [["all", "All"], ["ACTIVE", "Active"], ["FULLY_DEPRECIATED", "Fully depreciated"], ["DISPOSED", "Disposed"]];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest App</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><Boxes className="h-5 w-5 text-primary" /> Asset Management</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Register equipment, vehicles and property, track depreciation and keep a maintenance history.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><Plus className="mr-1 inline h-3.5 w-3.5" /> Add asset</button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([l, v]) => <div key={l} className="rounded-2xl border bg-background p-4 shadow-sm"><span className="text-[11px] text-muted-foreground">{l}</span><p className="mt-1 break-words text-xl font-bold">{v}</p></div>)}
      </div>

      {dueCount > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{dueCount} asset{dueCount > 1 ? "s have" : " has"} depreciation that hasn&apos;t been recorded yet. Use the catch-up button on each one.</div>}

      {showForm && (
        <section className="space-y-3 rounded-2xl border bg-background p-4 shadow-sm">
          <h2 className="text-sm font-bold">Register an asset</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className={field} placeholder="Name (e.g. Generator 20kVA)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <div><label className="mb-1 block text-[11px] text-muted-foreground">Purchase date</label><input type="date" className={field} value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></div>
            <div><label className="mb-1 block text-[11px] text-muted-foreground">Purchase cost</label><input type="number" inputMode="decimal" min="0" step="any" className={field} value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} /></div>
            <div><label className="mb-1 block text-[11px] text-muted-foreground">Useful life (months)</label><input type="number" inputMode="numeric" min="1" step="1" className={field} value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })} /></div>
            <div><label className="mb-1 block text-[11px] text-muted-foreground">Residual (scrap) value, optional</label><input type="number" inputMode="decimal" min="0" step="any" className={field} value={form.residualValue} onChange={(e) => setForm({ ...form, residualValue: e.target.value })} /></div>
          </div>
          <textarea className={field} rows={2} placeholder="Notes (serial number, location, supplier)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? "Saving..." : "Save asset"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2.5 text-xs font-semibold">Cancel</button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-background p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {chips.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === k ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>{l}</button>)}
          <input className="ml-auto w-full rounded-lg border bg-background px-3 py-1.5 text-xs sm:w-48" placeholder="Search assets" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {visible.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{data.assets.length === 0 ? "No assets yet. Tap Add asset to register your first one." : "Nothing matches this filter."}</p>
        ) : (
          <ul className="divide-y">
            {visible.map(({ a, monthly, nbv, pct, behind }) => (
              <li key={a.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.category} · <span className="font-mono">{a.assetNo}</span> · bought {new Date(a.purchaseDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLE[a.status] ?? STATUS_STYLE.DISPOSED}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Cost</p><p className="font-semibold">{money(a.purchaseCost)}</p></div>
                  <div><p className="text-muted-foreground">Book value</p><p className="font-semibold">{money(nbv)}</p></div>
                  <div><p className="text-muted-foreground">Per month</p><p className="font-semibold">{money(monthly)}</p></div>
                </div>
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{pct}% depreciated{behind > 0 ? ` · ${behind} month${behind > 1 ? "s" : ""} not yet recorded` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.status === "ACTIVE" && <button type="button" disabled={busy} onClick={() => run(() => depreciateAsset(slug, a.id, 1), "1 month recorded")} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50">+ 1 month</button>}
                  {a.status === "ACTIVE" && behind > 1 && <button type="button" disabled={busy} onClick={() => run(() => depreciateAsset(slug, a.id, behind), `${behind} months recorded`)} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50">Catch up {behind} months</button>}
                  <button type="button" onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-semibold"><Wrench className="h-3 w-3" /> Maintenance log</button>
                  {a.status !== "DISPOSED" && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Mark "${a.name}" as disposed? It will no longer count toward your totals.`)) run(() => disposeAsset(slug, a.id), "Asset disposed"); }} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50">Dispose</button>}
                  {a.accumulatedDepreciation === 0 && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete "${a.name}"? This can't be undone.`)) run(() => deleteAsset(slug, a.id), "Asset deleted"); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-semibold text-red-600 disabled:opacity-50"><Trash2 className="h-3 w-3" /> Delete</button>}
                </div>
                {expanded === a.id && (
                  <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                    {a.notes ? <pre className="whitespace-pre-wrap break-words font-sans text-xs">{a.notes}</pre> : <p className="text-xs text-muted-foreground">No notes or maintenance entries yet.</p>}
                    {logFor === a.id ? (
                      <div className="flex flex-wrap gap-2">
                        <input autoFocus className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs" placeholder="e.g. Serviced, replaced oil filter" value={logText} onChange={(e) => setLogText(e.target.value)} />
                        <button type="button" disabled={busy} onClick={() => run(() => addMaintenanceNote(slug, a.id, logText), "Entry added", () => { setLogText(""); setLogFor(null); })} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50">Add</button>
                        <button type="button" onClick={() => { setLogFor(null); setLogText(""); }} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setLogFor(a.id)} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold">+ Add entry</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
