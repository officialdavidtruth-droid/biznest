"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Check, Link2, MessageCircle, Phone, Plus, Scissors, Trash2, X } from "lucide-react";
import {
  createTailoringJobFromForm, deleteTailoringJob, findTailoringClient, recordTailoringPayment,
  updateTailoringPrice, updateTailoringStage, type TailoringJobDTO,
} from "@/lib/actions/tailoring";
import {
  MEASUREMENT_FIELDS, TAILORING_STAGES, TAILORING_STAGE_BLURB, tailoringBalance, tailoringStatusPath,
  isTailoringStage,
} from "@/lib/tailoring";
import { whatsappLink } from "@/lib/utils/whatsapp-link";
import { formatMoney } from "@/lib/utils/format-money";

const input = "rounded-lg border bg-background px-3 py-2 text-sm";
const dayFmt = (d: string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
const isOverdue = (j: TailoringJobDTO) => !!j.dueDate && j.stage !== "DELIVERED" && j.stage !== "READY" && new Date(j.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

export function TailoringWorkspace({ slug, initial, currency }: { slug: string; initial: TailoringJobDTO[]; currency: string }) {
  const [jobs, setJobs] = useState(initial);
  const [filter, setFilter] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [hint, setHint] = useState("");
  const [payFor, setPayFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const money = (n: number) => formatMoney(n, currency);
  const shown = jobs.filter((j) => filter === "ALL" || j.stage === filter);
  const count = (stage: string) => jobs.filter((j) => j.stage === stage).length;
  const owing = jobs.map((j) => tailoringBalance(j.price, j.amountPaid) ?? 0).filter((b) => b > 0);
  const outstanding = owing.reduce((n, b) => n + b, 0);

  const statusUrl = (j: TailoringJobDTO) => `${window.location.origin}${tailoringStatusPath(slug, j.trackingToken)}`;

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget;
    start(async () => {
      const r = await createTailoringJobFromForm(slug, new FormData(form));
      if (!r.success) { setMsg(r.error); return; }
      setMsg(""); setHint(""); setJobs((p) => [r.data, ...p]); setOpen(false); form.reset();
    });
  };

  // Returning customer: pull their saved measurements in when the phone number is entered.
  const lookup = (phone: string) => {
    if (phone.replace(/\D/g, "").length < 8) { setHint(""); return; }
    start(async () => {
      const r = await findTailoringClient(slug, phone);
      const form = formRef.current;
      if (!r.success || !r.data || !form) { setHint(r.success && !r.data ? "New customer. Their measurements will be saved for next time." : ""); return; }
      const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      const nameEl = field("customerName");
      if (nameEl && !nameEl.value) nameEl.value = r.data.name;
      const m = r.data.measurements;
      if (m) {
        const unit = field("unit"); if (unit) unit.value = m.unit;
        for (const f of MEASUREMENT_FIELDS) {
          const el = field(`m_${f.id}`);
          if (el && !el.value && m.values[f.id]) el.value = String(m.values[f.id]);
        }
      }
      setHint(m ? `Welcome back, ${r.data.name}. Saved measurements filled in. Change anything that's different.` : `Returning customer: ${r.data.name}.`);
    });
  };

  const move = (j: TailoringJobDTO, stage: string) => {
    const bal = tailoringBalance(j.price, j.amountPaid) ?? 0;
    if (stage === "DELIVERED" && bal > 0 && !window.confirm(`${j.customerName} still owes ${money(bal)}. Mark as delivered anyway?`)) return;
    start(async () => {
      const r = await updateTailoringStage(slug, j.id, stage);
      if (!r.success) { setMsg(r.error); return; }
      setMsg(""); setJobs((p) => p.map((x) => (x.id === j.id ? { ...x, stage } : x)));
    });
  };
  const remove = (id: string) => {
    if (!window.confirm("Delete this job? This can't be undone.")) return;
    start(async () => {
      const r = await deleteTailoringJob(slug, id);
      if (!r.success) { setMsg(r.error); return; }
      setJobs((p) => p.filter((j) => j.id !== id));
    });
  };
  const pay = (e: FormEvent<HTMLFormElement>, j: TailoringJobDTO) => {
    e.preventDefault();
    const amount = Number(new FormData(e.currentTarget).get("amount"));
    start(async () => {
      const r = await recordTailoringPayment(slug, j.id, amount);
      if (!r.success) { setMsg(r.error); return; }
      setMsg(""); setPayFor(null); setJobs((p) => p.map((x) => (x.id === j.id ? { ...x, amountPaid: r.data.amountPaid } : x)));
    });
  };
  const setPrice = (j: TailoringJobDTO) => {
    const raw = window.prompt(`Price for ${j.jobNo} (${currency})`, j.price != null ? String(j.price) : "");
    if (raw == null || raw.trim() === "") return;
    start(async () => {
      const r = await updateTailoringPrice(slug, j.id, Number(raw));
      if (!r.success) { setMsg(r.error); return; }
      setMsg(""); setJobs((p) => p.map((x) => (x.id === j.id ? { ...x, price: r.data.price } : x)));
    });
  };
  const copyLink = async (j: TailoringJobDTO) => {
    try { await navigator.clipboard.writeText(statusUrl(j)); setCopied(j.id); setTimeout(() => setCopied(null), 1800); }
    catch { window.prompt("Copy this link", statusUrl(j)); }
  };
  const waHref = (j: TailoringJobDTO) => {
    if (!j.customerPhone || !isTailoringStage(j.stage)) return null;
    const bal = tailoringBalance(j.price, j.amountPaid) ?? 0;
    const body = `Hi ${j.customerName}, update on your ${j.garmentType} (${j.jobNo}): ${TAILORING_STAGE_BLURB[j.stage]}${bal > 0 ? ` Balance due: ${money(bal)}.` : ""} Track it here: ${statusUrl(j)}`;
    return whatsappLink(j.customerPhone, body);
  };

  return (
    <div className="space-y-4">
      {outstanding > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
          <span className="text-muted-foreground">Outstanding balances</span>
          <span className="font-bold">{money(outstanding)} <span className="font-normal text-muted-foreground">across {owing.length} job{owing.length === 1 ? "" : "s"}</span></span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          <button onClick={() => setFilter("ALL")} className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${filter === "ALL" ? "border-primary bg-primary/10 text-primary" : ""}`}>All ({jobs.length})</button>
          {TAILORING_STAGES.map((s) => (
            <button key={s.id} onClick={() => setFilter(s.id)} className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${filter === s.id ? "border-primary bg-primary/10 text-primary" : ""}`}>{s.label} ({count(s.id)})</button>
          ))}
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" />New job</button>
      </div>

      {msg && <div className="flex items-center justify-between rounded-lg border border-[var(--bn-admin-danger-line)] bg-[var(--bn-admin-danger-soft)] p-2.5 text-xs text-[var(--bn-admin-danger)]"><span>{msg}</span><button onClick={() => setMsg("")} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button></div>}

      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((j) => {
          const m = j.measurements;
          const balance = tailoringBalance(j.price, j.amountPaid);
          const wa = waHref(j);
          return (
            <div key={j.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{j.jobNo}</p>
                  <p className="mt-0.5 font-semibold">{j.customerName}</p>
                  <p className="text-xs text-muted-foreground">{j.garmentType}</p>
                </div>
                <button onClick={() => remove(j.id)} disabled={pending} aria-label="Delete job" className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <select value={j.stage} disabled={pending} onChange={(e) => move(j, e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs font-semibold">
                  {TAILORING_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {j.dueDate && <span className={isOverdue(j) ? "font-bold text-red-600" : "text-muted-foreground"}>{isOverdue(j) ? "Overdue · " : "Due "}{dayFmt(j.dueDate)}</span>}
                {j.customerPhone && <a href={`tel:${j.customerPhone}`} className="inline-flex items-center gap-1 text-primary"><Phone className="h-3 w-3" />{j.customerPhone}</a>}
              </div>

              {/* Money */}
              <div className="mt-3 rounded-lg bg-muted/40 p-2.5 text-xs">
                {j.price == null ? (
                  <button onClick={() => setPrice(j)} disabled={pending} className="font-semibold text-primary">+ Set price</button>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span><span className="text-muted-foreground">Price </span><button onClick={() => setPrice(j)} disabled={pending} className="font-semibold underline-offset-2 hover:underline" aria-label="Edit price">{money(j.price)}</button></span>
                    <span><span className="text-muted-foreground">Paid </span><b>{money(j.amountPaid)}</b></span>
                    {balance && balance > 0
                      ? <span className="font-bold text-red-600">Balance {money(balance)}</span>
                      : <span className="inline-flex items-center gap-1 font-bold text-green-700"><Check className="h-3 w-3" />Paid in full</span>}
                  </div>
                )}
                {balance != null && balance > 0 && (payFor === j.id ? (
                  <form onSubmit={(e) => pay(e, j)} className="mt-2 flex gap-2">
                    <input required autoFocus name="amount" type="number" min="1" max={balance} step="0.01" defaultValue={balance} className={`${input} w-full py-1.5`} aria-label="Payment amount" />
                    <button disabled={pending} className="rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">Save</button>
                    <button type="button" onClick={() => setPayFor(null)} aria-label="Cancel" className="px-1 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                  </form>
                ) : (
                  <button onClick={() => setPayFor(j.id)} className="mt-2 font-semibold text-primary">Record payment</button>
                ))}
              </div>

              {m && <p className="mt-3 text-[11px] text-muted-foreground">{MEASUREMENT_FIELDS.filter((f) => m.values[f.id]).map((f) => `${f.label} ${m.values[f.id]}${m.unit}`).join(" · ")}</p>}
              {j.fabric && <p className="mt-1 text-[11px] text-muted-foreground">Fabric: {[j.fabric.description, j.fabric.yards ? `${j.fabric.yards} yd` : null].filter(Boolean).join(", ")}</p>}
              {j.notes && <p className="mt-1 text-[11px] text-muted-foreground">{j.notes}</p>}

              {/* Customer status link */}
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3 text-xs">
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 font-bold text-white"><MessageCircle className="h-3.5 w-3.5" />Send update</a>}
                <button onClick={() => copyLink(j)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold">{copied === j.id ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Link2 className="h-3.5 w-3.5" />Copy status link</>}</button>
              </div>
            </div>
          );
        })}
        {!shown.length && (
          <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Scissors className="mx-auto mb-2 h-5 w-5" />{jobs.length ? "No jobs in this stage." : "No tailoring jobs yet. Add your first job to start tracking measurements, payments and deadlines."}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-base font-bold">New tailoring job</h2><button onClick={() => { setOpen(false); setHint(""); }} aria-label="Close"><X className="h-4 w-4" /></button></div>
            <form ref={formRef} onSubmit={create} className="mt-4 grid gap-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="customerPhone" type="tel" placeholder="Customer phone" onBlur={(e) => lookup(e.target.value)} className={input} />
                <input required name="customerName" placeholder="Customer name" className={input} />
              </div>
              {hint && <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">{hint}</p>}
              <div className="grid gap-2 sm:grid-cols-2"><input required name="garmentType" placeholder="Garment (e.g. Agbada, 2-piece suit)" className={input} /><input name="dueDate" type="date" className={input} /></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="price" type="number" min="0" step="0.01" placeholder={`Price (${currency})`} className={input} />
                <input name="amountPaid" type="number" min="0" step="0.01" placeholder="Deposit paid" className={input} />
              </div>
              <div className="flex items-center justify-between pt-1"><p className="text-xs font-bold">Measurements (optional)</p>
                <select name="unit" defaultValue="in" className="rounded-md border bg-background px-2 py-1 text-xs"><option value="in">inches</option><option value="cm">cm</option></select></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEASUREMENT_FIELDS.map((f) => <input key={f.id} name={`m_${f.id}`} type="number" step="0.1" min="0" placeholder={f.label} className={input} />)}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_7rem]"><input name="fabric" placeholder="Fabric (e.g. Ankara, aso-oke)" className={input} /><input name="yards" type="number" step="0.5" min="0" placeholder="Yards" className={input} /></div>
              <textarea name="notes" rows={2} placeholder="Notes (style, lining, buttons…)" className={input} />
              <button disabled={pending} className="mt-1 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground">{pending ? "Saving…" : "Create job"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
