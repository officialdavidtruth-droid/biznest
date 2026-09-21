"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { AlertCircle, Building2, CalendarClock, ChevronRight, CheckCircle2, Inbox, LayoutGrid, List, Mail, Phone, Plus, Search, Target, Users, Wallet, X } from "lucide-react";
import Link from "next/link";
import { createCrmLead, updateCrmLeadStatus } from "@/lib/actions/seo-crm";
import { LeadDrawer } from "@/components/dashboard/crm-lead-drawer";
import { SOURCES, STAGES, followUpState, initials, isClosed, money, nextStage, shortDate, sourceLabel, stageOf, type Lead } from "@/components/dashboard/crm-types";

type Notice = { tone: "ok" | "error"; text: string } | null;

export function CrmWorkspace({
  slug,
  initial,
}: {
  slug: string;
  initial: { leads: Lead[]; customerCount: number; wonCount: number; wonValue: number };
}) {
  const [leads, setLeads] = useState<Lead[]>(initial.leads);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [now, setNow] = useState<number | null>(null);
  const [, start] = useTransition();

  useEffect(() => setNow(Date.now()), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const open = leads.filter((l) => !isClosed(l.status));
  const openValue = open.reduce((sum, l) => sum + Number(l.value ?? 0), 0);
  const dueLeads = open.filter((l) => ["overdue", "today"].includes(followUpState(l, now)));
  const overdueCount = open.filter((l) => followUpState(l, now) === "overdue").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (source && l.source !== source) return false;
      if (dueOnly && !["overdue", "today"].includes(followUpState(l, now))) return false;
      if (!q) return true;
      return [l.name, l.email, l.phone, l.company].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [leads, query, source, dueOnly, now]);

  function move(id: string, status: string) {
    const prev = leads.find((l) => l.id === id)?.status;
    if (!prev || prev === status) return;
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status } : l)));
    start(async () => {
      const r = await updateCrmLeadStatus(slug, id, status);
      if (r.success) setNotice({ tone: "ok", text: `Moved to ${stageOf(status).label}.` });
      else {
        setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status: prev } : l)));
        setNotice({ tone: "error", text: ("error" in r && r.error) || "Could not update lead." });
      }
    });
  }

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) || "").trim();
    const value = Number(f.get("value") || 0);
    const follow = text("follow");
    const nextFollowUpAt = follow ? new Date(`${follow}T09:00:00`).toISOString() : undefined;
    start(async () => {
      const r = await createCrmLead(slug, { name: text("name"), email: text("email"), phone: text("phone"), company: text("company"), source: text("source") || "MANUAL", value, notes: text("notes"), nextFollowUpAt });
      if (r.success && "data" in r && r.data) {
        setLeads((cur) => [{ id: r.data.id, name: text("name"), email: text("email") || null, phone: text("phone") || null, company: text("company") || null, source: text("source") || "MANUAL", status: "NEW", value: value > 0 ? value : null, currency: "NGN", notes: text("notes") || null, nextFollowUpAt: nextFollowUpAt ?? null, createdAt: new Date().toISOString(), activities: [] }, ...cur]);
        setShowNew(false);
        setNotice({ tone: "ok", text: `${text("name")} added to New.` });
      } else setNotice({ tone: "error", text: ("error" in r && r.error) || "Could not create lead." });
    });
  }

  const empty = leads.length === 0;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Open pipeline" value={money(openValue)} sub={`${open.length} open lead${open.length === 1 ? "" : "s"}`} />
        <Kpi icon={CalendarClock} label="Follow-ups due" value={String(dueLeads.length)} sub={overdueCount ? `${overdueCount} overdue` : "Nothing overdue"} tone={overdueCount ? "warn" : undefined} onClick={dueLeads.length ? () => { setDueOnly(true); setView("list"); } : undefined} />
        <Kpi icon={CheckCircle2} label="Won deals" value={initial.wonCount.toLocaleString()} sub={`${money(initial.wonValue)} closed`} />
        <Kpi icon={Users} label="Customers" value={initial.customerCount.toLocaleString()} sub="Open Customer 360" href={`/store/${slug}/admin/customers`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone…" aria-label="Search leads" className="w-full rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source" className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" aria-pressed={dueOnly} onClick={() => setDueOnly((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${dueOnly ? "border-primary bg-[hsl(var(--primary)/0.1)] text-primary" : "hover:border-primary/50"}`}>
          <CalendarClock className="h-3.5 w-3.5" />Follow-ups due{dueLeads.length ? ` (${dueLeads.length})` : ""}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border text-xs font-semibold" role="group" aria-label="View">
            <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")} className={`inline-flex items-center gap-1.5 px-3 py-2 ${view === "board" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><LayoutGrid className="h-3.5 w-3.5" />Board</button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 px-3 py-2 ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><List className="h-3.5 w-3.5" />List</button>
          </div>
          <button type="button" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Add lead</button>
        </div>
      </div>

      {notice && (
        <div role="status" className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${notice.tone === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-rose-500/30 bg-rose-500/10 text-rose-700"}`}>
          {notice.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{notice.text}
        </div>
      )}

      {empty ? (
        <div className="rounded-2xl border border-dashed bg-background p-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-primary"><Inbox className="h-6 w-6" /></span>
          <h2 className="mt-4 text-lg font-semibold">Your pipeline is empty</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Add your first lead to start tracking it from first contact to closed deal. Anyone who fills in a form or book on your website can show up here too.</p>
          <button type="button" onClick={() => setShowNew(true)} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Add your first lead</button>
        </div>
      ) : view === "board" ? (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3" aria-label="Sales pipeline">
          {STAGES.map((stage) => {
            const col = filtered.filter((l) => l.status === stage.id);
            const total = col.reduce((s, l) => s + Number(l.value ?? 0), 0);
            const isOver = overStage === stage.id && dragId !== null;
            return (
              <section
                key={stage.id}
                aria-label={`${stage.label} stage`}
                onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverStage(stage.id); } }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; setOverStage(null); setDragId(null); if (id) move(id, stage.id); }}
                className={`flex max-h-[68vh] min-w-[252px] flex-1 snap-start flex-col overflow-hidden rounded-2xl border bg-muted/40 transition ${isOver ? "ring-2 ring-primary/50" : ""}`}
              >
                <div aria-hidden className={`h-1 w-full shrink-0 ${stage.dot}`} />
                <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold"><span className={`h-2 w-2 rounded-full ${stage.dot}`} />{stage.label}<span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{col.length}</span></p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{total ? money(total) : stage.hint}</p>
                  </div>
                </header>
                <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-3">
                  {col.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} now={now} dragging={dragId === lead.id} onOpen={() => setSelectedId(lead.id)} onDragStart={() => setDragId(lead.id)} onDragEnd={() => { setDragId(null); setOverStage(null); }} onAdvance={(to) => move(lead.id, to)} />
                  ))}
                  {!col.length && <p className="rounded-xl border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">{dragId ? "Drop here" : "No leads"}</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-4 py-3 font-medium">Lead</th><th className="px-4 py-3 font-medium">Stage</th><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 text-right font-medium">Value</th><th className="px-4 py-3 font-medium">Follow-up</th></tr></thead>
              <tbody>
                {filtered.map((l) => {
                  const st = stageOf(l.status);
                  const fu = followUpState(l, now);
                  return (
                    <tr key={l.id} tabIndex={0} onClick={() => setSelectedId(l.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedId(l.id)} className="cursor-pointer border-b last:border-0 hover:bg-muted/40 focus:bg-muted/40 focus:outline-none">
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-[11px] font-bold text-primary">{initials(l.name)}</span><div className="min-w-0"><p className="truncate font-semibold">{l.name}</p><p className="truncate text-xs text-muted-foreground">{l.company || l.email || l.phone || "No contact details"}</p></div></div></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${st.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">{sourceLabel(l.source)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{l.value ? money(l.value) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3"><FollowUp lead={l} state={fu} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filtered.length && <p className="p-10 text-center text-sm text-muted-foreground">No leads match these filters.</p>}
        </div>
      )}

      {!empty && filtered.length === 0 && view === "board" && (
        <p className="text-center text-sm text-muted-foreground">No leads match these filters. <button type="button" className="font-semibold text-primary underline" onClick={() => { setQuery(""); setSource(""); setDueOnly(false); }}>Clear filters</button></p>
      )}

      {selected && (
        <LeadDrawer
          key={selected.id}
          slug={slug}
          lead={selected}
          onClose={() => setSelectedId(null)}
          onMove={(status) => move(selected.id, status)}
          onPatch={(patch) => setLeads((cur) => cur.map((l) => (l.id === selected.id ? { ...l, ...patch } : l)))}
          onActivity={(a) => setLeads((cur) => cur.map((l) => (l.id === selected.id ? { ...l, activities: [a, ...l.activities] } : l)))}
        />
      )}

      {showNew && (
        <Modal title="Add a new lead" onClose={() => setShowNew(false)}>
          <form onSubmit={add} className="grid gap-3">
            <Input name="name" label="Full name" required autoFocus />
            <div className="grid gap-3 sm:grid-cols-2"><Input name="email" label="Email" type="email" /><Input name="phone" label="Phone" type="tel" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="company" label="Company" />
              <label className="grid gap-1.5 text-xs font-medium">Where did they come from?
                <select name="source" defaultValue="MANUAL" className="rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary">
                  {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2"><Input name="value" label="Estimated value (₦)" type="number" /><Input name="follow" label="Follow up on" type="date" /></div>
            <label className="grid gap-1.5 text-xs font-medium">Notes<textarea name="notes" rows={3} className="rounded-lg border bg-background p-3 text-sm font-normal outline-none focus:border-primary" /></label>
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
              <button type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Create lead</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function LeadCard({ lead, now, dragging, onOpen, onDragStart, onDragEnd, onAdvance }: { lead: Lead; now: number | null; dragging: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void; onAdvance: (to: string) => void }) {
  const next = nextStage(lead.status) ?? (lead.status === "PROPOSAL" ? stageOf("WON") : null);
  const fu = followUpState(lead, now);
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", lead.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`group cursor-grab rounded-xl border bg-background p-3 shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-[11px] font-bold text-primary">{initials(lead.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{lead.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">{lead.company ? <><Building2 className="h-3 w-3 shrink-0" />{lead.company}</> : sourceLabel(lead.source)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="text-sm font-bold tabular-nums">{lead.value ? money(lead.value) : <span className="text-xs font-normal text-muted-foreground">No value yet</span>}</span>
        <FollowUp lead={lead} state={fu} compact />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{sourceLabel(lead.source)}</span>
        <span className="flex items-center gap-1">
          {lead.email && <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} aria-label={`Email ${lead.name}`} className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"><Mail className="h-3.5 w-3.5" /></a>}
          {lead.phone && <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} aria-label={`Call ${lead.name}`} className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"><Phone className="h-3.5 w-3.5" /></a>}
          {next && <button type="button" onClick={(e) => { e.stopPropagation(); onAdvance(next.id); }} aria-label={`Move ${lead.name} to ${next.label}`} title={`Move to ${next.label}`} className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-semibold text-primary opacity-0 transition hover:bg-[hsl(var(--primary)/0.1)] focus:opacity-100 group-hover:opacity-100">{next.label}<ChevronRight className="h-3 w-3" /></button>}
        </span>
      </div>
    </div>
  );
}

function FollowUp({ lead, state, compact }: { lead: Lead; state: ReturnType<typeof followUpState>; compact?: boolean }) {
  if (!lead.nextFollowUpAt) return <span className="text-xs text-muted-foreground">{compact ? "" : "—"}</span>;
  if (isClosed(lead.status)) return <span className="text-xs text-muted-foreground">{compact ? "" : "Closed"}</span>;
  const tone = state === "overdue" ? "bg-rose-500/10 text-rose-700" : state === "today" ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground";
  const label = state === "overdue" ? `Overdue · ${shortDate(lead.nextFollowUpAt)}` : state === "today" ? "Today" : shortDate(lead.nextFollowUpAt);
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}><CalendarClock className="h-3 w-3" />{label}</span>;
}

function Kpi({ icon: Icon, label, value, sub, tone, onClick, href }: { icon: typeof Target; label: string; value: string; sub: string; tone?: "warn"; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-primary"><Icon className="h-4 w-4" /></span></div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className={`mt-1 text-[11px] ${tone === "warn" ? "font-semibold text-rose-600" : "text-muted-foreground"}`}>{sub}</p>
    </>
  );
  const cls = "block rounded-2xl border bg-background p-4 text-left shadow-sm";
  if (href) return <Link href={href} className={`${cls} transition hover:border-primary/50`}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full transition hover:border-primary/50`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

function Input({ name, label, type = "text", required, autoFocus }: { name: string; label: string; type?: string; required?: boolean; autoFocus?: boolean }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium">
      {label}{required && <span className="text-rose-600"> *</span>}
      <input name={name} type={type} required={required} autoFocus={autoFocus} className="rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary" />
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border bg-background p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}
