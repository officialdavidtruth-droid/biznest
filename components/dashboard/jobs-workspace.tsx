"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addJobCharge, addJobItem, billJob, cancelJobCard, createJobCard, postJobUpdate, recordJobPayment, removeJobItem, requestEstimateApproval, setJobStage, updateJobNotes, voidJobCharge,
} from "@/lib/actions/jobs";
import { ITEM_KINDS, JOB_PAYMENT_METHODS, NICHES, PROFILES, profileFor, type Niche } from "@/lib/jobs";
import type { JobsData } from "@/lib/jobs-data";

type Result = { success: boolean; error?: string };
type Job = JobsData["jobs"][number];
const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";
const btn = "rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60";
const ghost = "rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60";
const cap = (m: string) => m[0] + m.slice(1).toLowerCase();

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

export function JobsWorkspace({ slug, data, jobBase, defaultNiche }: { slug: string; data: JobsData; jobBase: string; defaultNiche: Niche }) {
  const a = useAction();
  const blank = { niche: defaultNiche as string, title: "", customerName: "", customerPhone: "", customerEmail: "", subject: "", subjectDetail: "", scheduledFor: "" };
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState<string | null>(null);
  const [show, setShow] = useState<"OPEN" | "DONE" | "CANCELLED">("OPEN");
  const p = profileFor(f.niche);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const list = data.jobs.filter((j) => j.status === show);
  const owing = data.jobs.filter((j) => j.status !== "CANCELLED").reduce((s, j) => s + j.owing, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Open jobs", String(data.jobs.filter((j) => j.status === "OPEN").length)], ["Awaiting approval", String(data.jobs.filter((j) => j.estimateStatus === "PENDING" && j.status === "OPEN").length)], ["Completed", String(data.jobs.filter((j) => j.status === "DONE").length)], ["Owing", ngn(owing)]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold">{v}</p></div>
        ))}
      </div>
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); a.run(() => createJobCard(slug, f), "Job created.", () => setF({ ...blank, niche: f.niche })); }}>
        <select className={input} value={f.niche} onChange={set("niche")} aria-label="Type of job">{NICHES.map((n) => <option key={n} value={n}>{PROFILES[n].label}</option>)}</select>
        <input className={input} placeholder="Job title, e.g. Brake service" aria-label="Job title" value={f.title} onChange={set("title")} />
        <input className={input} placeholder="Customer name" aria-label="Customer name" value={f.customerName} onChange={set("customerName")} />
        <input className={input} placeholder="Phone" aria-label="Phone" value={f.customerPhone} onChange={set("customerPhone")} />
        <input className={input} placeholder="Email (for updates)" aria-label="Email" value={f.customerEmail} onChange={set("customerEmail")} />
        <input className={input} placeholder={`${p.subjectLabel}: ${p.subjectPlaceholder}`} aria-label={p.subjectLabel} value={f.subject} onChange={set("subject")} />
        <input className={input} placeholder={`${p.detailLabel}: ${p.detailPlaceholder}`} aria-label={p.detailLabel} value={f.subjectDetail} onChange={set("subjectDetail")} />
        <input className={input} type="datetime-local" aria-label="Scheduled for" value={f.scheduledFor} onChange={set("scheduledFor")} />
        <button className={btn} disabled={a.pending}>Create job</button>
        <div className="md:col-span-4"><Msg error={a.error} note={a.note} /></div>
      </form>
      <div className="flex gap-2" role="tablist">
        {(["OPEN", "DONE", "CANCELLED"] as const).map((s) => <button key={s} role="tab" aria-selected={show === s} onClick={() => setShow(s)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${show === s ? "bg-primary text-primary-foreground" : "border"}`}>{s === "OPEN" ? "Open" : s === "DONE" ? "Completed" : "Cancelled"}</button>)}
      </div>
      <ul className="space-y-2">
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
        {list.map((j) => (
          <li key={j.id} className="rounded-xl border bg-card">
            <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen(open === j.id ? null : j.id)} aria-expanded={open === j.id}>
              <span><b className="text-sm">{j.jobNo} · {j.title}</b><span className="block text-xs text-muted-foreground">{j.customerName}{j.subject ? ` · ${j.subject}` : ""}</span></span>
              <span className="text-right text-xs"><b>{j.stageLabel}</b>{j.owing > 0 && <span className="block text-red-600">{ngn(j.owing)} owing</span>}</span>
            </button>
            {open === j.id && <JobPanel slug={slug} j={j} jobBase={jobBase} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobPanel({ slug, j, jobBase }: { slug: string; j: Job; jobBase: string }) {
  const a = useAction();
  const p = profileFor(j.niche);
  const [stage, setStage] = useState(j.stage);
  const [msg, setMsg] = useState("");
  const [img, setImg] = useState("");
  const [item, setItem] = useState({ kind: p.itemKinds[0], label: "", qty: "1", unitPrice: "" });
  const [pct, setPct] = useState(String(p.defaultDepositPct));
  const [pay, setPay] = useState<{ id: string; method: string } | null>(null);
  const [notes, setNotes] = useState({ internalNotes: j.internalNotes ?? "", deliverableUrl: j.deliverableUrl ?? "" });
  const closed = j.status !== "OPEN";
  const link = `${jobBase}${j.accessToken}`;
  return (
    <div className="space-y-5 border-t p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly className={`${input} max-w-sm`} value={link} aria-label="Customer link" onFocus={(e) => e.currentTarget.select()} />
        <button className={ghost} onClick={() => navigator.clipboard?.writeText(link)}>Copy customer link</button>
        {!closed && <button className={ghost} disabled={a.pending} onClick={() => confirm("Cancel this job? Unpaid charges are cancelled too.") && a.run(() => cancelJobCard(slug, j.id))}>Cancel job</button>}
      </div>
      <Msg error={a.error} note={a.note} />

      {!closed && (
        <div className="space-y-2">
          <p className="text-xs font-bold">Progress</p>
          <div className="flex flex-wrap gap-2">
            <select className={`${input} max-w-xs`} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">{p.stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            <input className={`${input} max-w-xs`} placeholder="Message to customer (optional)" aria-label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <input className={`${input} max-w-xs`} placeholder="Photo link, https:// (optional)" aria-label="Photo link" value={img} onChange={(e) => setImg(e.target.value)} />
            <button className={btn} disabled={a.pending} onClick={() => a.run(() => stage === j.stage ? postJobUpdate(slug, j.id, msg, img) : setJobStage(slug, j.id, stage, msg, img), "Customer updated.", () => { setMsg(""); setImg(""); })}>{stage === j.stage ? "Post update" : "Move to stage"}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-bold">Estimate · {j.estimateStatus === "NONE" ? "not sent" : j.estimateStatus.toLowerCase()}</p>
        <ul className="space-y-1">
          {j.items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.qty} × {i.label} <span className="text-xs text-muted-foreground">{cap(i.kind)}</span></span><span className="flex items-center gap-2"><b>{ngn(i.qty * i.unitPrice)}</b>{!closed && <button className="text-xs underline" disabled={a.pending} onClick={() => a.run(() => removeJobItem(slug, i.id))}>Remove</button>}</span></li>)}
          {j.items.length > 0 && <li className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{ngn(j.total)}</span></li>}
        </ul>
        {!closed && (
          <form className="grid gap-2 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); a.run(() => addJobItem(slug, j.id, { kind: item.kind, label: item.label, qty: Number(item.qty), unitPrice: Number(item.unitPrice) }), undefined, () => setItem({ ...item, label: "", unitPrice: "", qty: "1" })); }}>
            <select className={input} value={item.kind} onChange={(e) => setItem({ ...item, kind: e.target.value })} aria-label="Kind">{ITEM_KINDS.filter((k) => p.itemKinds.includes(k)).map((k) => <option key={k} value={k}>{cap(k)}</option>)}</select>
            <input className={input} placeholder="Description" aria-label="Description" value={item.label} onChange={(e) => setItem({ ...item, label: e.target.value })} />
            <input className={input} type="number" min="1" aria-label="Quantity" value={item.qty} onChange={(e) => setItem({ ...item, qty: e.target.value })} />
            <input className={input} type="number" min="0" placeholder="Unit price" aria-label="Unit price" value={item.unitPrice} onChange={(e) => setItem({ ...item, unitPrice: e.target.value })} />
            <button className={ghost} disabled={a.pending}>Add item</button>
          </form>
        )}
        {!closed && j.items.length > 0 && j.estimateStatus !== "APPROVED" && <button className={btn} disabled={a.pending} onClick={() => a.run(() => requestEstimateApproval(slug, j.id), "Estimate sent for approval.")}>{j.estimateStatus === "PENDING" ? "Send reminder" : "Send for customer approval"}</button>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold">Billing</p>
        <ul className="space-y-2">
          {j.charges.map((c) => (
            <li key={c.id}>
              <div className="flex justify-between gap-3"><span>{c.label} <span className="text-xs text-muted-foreground">{c.status === "PAID" ? `paid${c.receiptNo ? ` · ${c.receiptNo}` : ""}${c.method ? ` · ${cap(c.method)}` : ""}` : "due"}</span></span><b>{ngn(c.amount)}</b></div>
              {c.status === "DUE" && (pay && pay.id === c.id ? (
                <div className="mt-1 flex gap-2">
                  <select className={`${input} w-32`} value={pay.method} onChange={(e) => setPay({ id: c.id, method: e.target.value })} aria-label="Payment method">{JOB_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{cap(m)}</option>)}</select>
                  <button className={btn} disabled={a.pending} onClick={() => a.run(() => recordJobPayment(slug, c.id, { method: pay.method }), "Payment recorded.", () => setPay(null))}>Save</button>
                  <button className={ghost} onClick={() => setPay(null)}>Close</button>
                </div>
              ) : (
                <div className="mt-1 flex gap-2"><button className={ghost} onClick={() => setPay({ id: c.id, method: "CASH" })}>Record payment</button><button className={ghost} disabled={a.pending} onClick={() => confirm("Cancel this charge?") && a.run(() => voidJobCharge(slug, c.id))}>Cancel charge</button></div>
              ))}
            </li>
          ))}
          {j.charges.length === 0 && <p className="text-xs text-muted-foreground">Nothing billed yet.</p>}
        </ul>
        {!closed && j.items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {j.charges.length === 0 && <label className="flex items-center gap-1 text-xs">Deposit %<input className={`${input} w-20`} type="number" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} aria-label="Deposit percent" /></label>}
            <button className={btn} disabled={a.pending} onClick={() => a.run(() => billJob(slug, j.id, Number(pct || 0)), "Billed.")}>{j.charges.length === 0 ? "Bill from estimate" : "Bill the remaining balance"}</button>
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold">Internal notes (customer can't see)<textarea className={`${input} font-normal`} rows={3} value={notes.internalNotes} onChange={(e) => setNotes({ ...notes, internalNotes: e.target.value })} /></label>
        {p.deliverableLabel && <label className="grid gap-1 text-xs font-bold">{p.deliverableLabel} link (shown when nothing is owing)<input className={`${input} font-normal`} placeholder="https://" value={notes.deliverableUrl} onChange={(e) => setNotes({ ...notes, deliverableUrl: e.target.value })} /></label>}
        <button className={`${ghost} md:col-span-2 justify-self-start`} disabled={a.pending} onClick={() => a.run(() => updateJobNotes(slug, j.id, notes), "Saved.")}>Save notes{p.deliverableLabel ? " and link" : ""}</button>
      </div>
    </div>
  );
}
