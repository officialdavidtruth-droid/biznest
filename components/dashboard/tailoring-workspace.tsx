"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Phone, Plus, Scissors, Trash2, X } from "lucide-react";
import { createTailoringJobFromForm, deleteTailoringJob, updateTailoringStage, type TailoringJobDTO } from "@/lib/actions/tailoring";
import { MEASUREMENT_FIELDS, TAILORING_STAGES } from "@/lib/tailoring";

const input = "rounded-lg border bg-background px-3 py-2 text-sm";
const dayFmt = (d: string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
const isOverdue = (j: TailoringJobDTO) => !!j.dueDate && j.stage !== "DELIVERED" && j.stage !== "READY" && new Date(j.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

export function TailoringWorkspace({ slug, initial }: { slug: string; initial: TailoringJobDTO[] }) {
  const [jobs, setJobs] = useState(initial);
  const [filter, setFilter] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const shown = jobs.filter((j) => filter === "ALL" || j.stage === filter);
  const count = (stage: string) => jobs.filter((j) => j.stage === stage).length;

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget;
    start(async () => {
      const r = await createTailoringJobFromForm(slug, new FormData(form));
      if (!r.success) { setMsg(r.error); return; }
      setMsg(""); setJobs((p) => [r.data, ...p]); setOpen(false); form.reset();
    });
  };
  const move = (id: string, stage: string) =>
    start(async () => {
      const r = await updateTailoringStage(slug, id, stage);
      if (!r.success) { setMsg(r.error); return; }
      setMsg(""); setJobs((p) => p.map((j) => (j.id === id ? { ...j, stage } : j)));
    });
  const remove = (id: string) => {
    if (!window.confirm("Delete this job? This can't be undone.")) return;
    start(async () => {
      const r = await deleteTailoringJob(slug, id);
      if (!r.success) { setMsg(r.error); return; }
      setJobs((p) => p.filter((j) => j.id !== id));
    });
  };

  return (
    <div className="space-y-4">
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
                <select value={j.stage} disabled={pending} onChange={(e) => move(j.id, e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs font-semibold">
                  {TAILORING_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {j.dueDate && <span className={isOverdue(j) ? "font-bold text-red-600" : "text-muted-foreground"}>{isOverdue(j) ? "Overdue · " : "Due "}{dayFmt(j.dueDate)}</span>}
                {j.customerPhone && <a href={`tel:${j.customerPhone}`} className="inline-flex items-center gap-1 text-primary"><Phone className="h-3 w-3" />{j.customerPhone}</a>}
              </div>
              {m && <p className="mt-3 text-[11px] text-muted-foreground">{MEASUREMENT_FIELDS.filter((f) => m.values[f.id]).map((f) => `${f.label} ${m.values[f.id]}${m.unit}`).join(" · ")}</p>}
              {j.fabric && <p className="mt-1 text-[11px] text-muted-foreground">Fabric: {[j.fabric.description, j.fabric.yards ? `${j.fabric.yards} yd` : null].filter(Boolean).join(", ")}</p>}
              {j.notes && <p className="mt-1 text-[11px] text-muted-foreground">{j.notes}</p>}
            </div>
          );
        })}
        {!shown.length && (
          <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Scissors className="mx-auto mb-2 h-5 w-5" />{jobs.length ? "No jobs in this stage." : "No tailoring jobs yet. Add your first job to start tracking measurements and deadlines."}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="text-base font-bold">New tailoring job</h2><button onClick={() => setOpen(false)} aria-label="Close"><X className="h-4 w-4" /></button></div>
            <form onSubmit={create} className="mt-4 grid gap-2.5">
              <div className="grid gap-2 sm:grid-cols-2"><input required name="customerName" placeholder="Customer name" className={input} /><input name="customerPhone" type="tel" placeholder="Customer phone" className={input} /></div>
              <div className="grid gap-2 sm:grid-cols-2"><input required name="garmentType" placeholder="Garment (e.g. Agbada, 2-piece suit)" className={input} /><input name="dueDate" type="date" className={input} /></div>
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
