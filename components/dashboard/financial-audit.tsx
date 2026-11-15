"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ClipboardCheck, Download, FileCheck2, Plus, Printer, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  addAuditFinding, createFinancialAudit, deleteFinancialAudit, listFinancialAudits, postAuditVariance, recordAuditCount, reopenAudit,
  signOffAudit, submitAuditForReview, updateAuditFinding, type AuditView,
} from "@/lib/actions/financial-audit";
import { lineVariance, summariseCount } from "@/lib/financial/audit-math";
import { toCsv } from "@/lib/financial/statements";
import { formatMoney } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";
import { Badge, Chip, Stat, btnGhost, btnPrimary, card, download, field } from "@/components/dashboard/fin-ui";

type AuditType = "STOCK" | "CASH" | "ASSETS" | "GENERAL";
const TYPES: { id: AuditType; label: string; blurb: string }[] = [
  { id: "STOCK", label: "Stock count", blurb: "Count goods on the shelf against the system." },
  { id: "CASH", label: "Cash & bank count", blurb: "Count the till and confirm bank balances." },
  { id: "ASSETS", label: "Fixed assets check", blurb: "Verify each asset exists and where it should be." },
  { id: "GENERAL", label: "General review", blurb: "Controls, procedures and records. Findings only." },
];
const STATUS_TONE: Record<string, string> = { IN_PROGRESS: "blue", UNDER_REVIEW: "amber", SIGNED_OFF: "green", PLANNED: "grey" };
const STATUS_LABEL: Record<string, string> = { IN_PROGRESS: "Counting", UNDER_REVIEW: "Under review", SIGNED_OFF: "Signed off", PLANNED: "Planned" };
const SEV_TONE: Record<string, string> = { LOW: "grey", MEDIUM: "blue", HIGH: "amber", CRITICAL: "red" };
const typeLabel = (t: string) => TYPES.find((x) => x.id === t)?.label ?? t;

export function FinancialAudit({ slug, currency, startNew }: { slug: string; currency?: string; startNew?: boolean }) {
  const [audits, setAudits] = useState<AuditView[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(!!startNew);
  const [busy, start] = useTransition();

  const reload = () => start(async () => {
    const res = await listFinancialAudits(slug);
    if (res.success) setAudits(res.data); else toast.error(res.error);
  });
  useEffect(reload, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (startNew) setCreating(true); }, [startNew]);

  const money = (n: number) => formatMoney(n, currency);
  const current = audits?.find((a) => a.id === openId) ?? null;

  if (current) return <AuditDetail slug={slug} audit={current} money={money} onBack={() => setOpenId(null)} onChanged={reload} busy={busy} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-bold">Audits</h2><p className="mt-1 text-sm text-[var(--bn-admin-muted)]">Count stock, cash and assets against the books, record findings, and sign off with a clear record.</p></div>
        {!creating && <button className={btnPrimary} onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New audit</button>}
      </div>

      {creating && <NewAudit slug={slug} onCancel={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id); reload(); }} />}

      {audits && audits.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Open audits" value={String(audits.filter((a) => a.status !== "SIGNED_OFF").length)} />
          <Stat label="Open findings" value={String(audits.reduce((s, a) => s + a.findings.filter((f) => f.status === "OPEN").length, 0))} tone={audits.some((a) => a.findings.some((f) => f.status === "OPEN" && (f.severity === "HIGH" || f.severity === "CRITICAL"))) ? "bad" : undefined} />
          <Stat label="Signed off" value={String(audits.filter((a) => a.status === "SIGNED_OFF").length)} />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {(audits ?? []).map((a) => (
          <button key={a.id} onClick={() => setOpenId(a.id)} className={`${card} p-4 text-left transition hover:border-[var(--bn-admin-orange)]`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-bold">{a.title}</p><p className="mt-0.5 text-xs text-[var(--bn-admin-muted)]">{a.auditNo} · {typeLabel(a.type)} · {formatDate(new Date(a.startedAt), { day: "numeric", month: "short", year: "numeric" })}</p></div>
              <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
            </div>
            {a.lines.length > 0 && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bn-admin-surface-2)]"><div className="h-full rounded-full bg-[var(--bn-admin-orange)]" style={{ width: `${a.summary.progressPct}%` }} /></div>
                <p className="mt-2 text-xs text-[var(--bn-admin-muted)]">{a.summary.counted} of {a.summary.total} counted · net variance <b className={a.summary.netVariance > 0 ? "text-rose-600" : "text-[var(--bn-admin-text)]"}>{money(a.summary.netVariance)}</b></p>
              </div>
            )}
            {a.findings.length > 0 && <p className="mt-2 text-xs text-[var(--bn-admin-muted)]">{a.findings.filter((f) => f.status === "OPEN").length} open finding(s) of {a.findings.length}</p>}
          </button>
        ))}
      </div>
      {audits && audits.length === 0 && !creating && (
        <div className={`${card} flex flex-col items-center gap-3 px-4 py-14 text-center`}>
          <ClipboardCheck className="h-8 w-8 text-[var(--bn-admin-muted)]" />
          <p className="max-w-md text-sm text-[var(--bn-admin-muted)]">No audits yet. Start with a stock count: BizNest freezes what the system says you hold, you enter what is actually on the shelf, and the differences are valued for you.</p>
          <button className={btnPrimary} onClick={() => setCreating(true)}>Start the first audit</button>
        </div>
      )}
      {!audits && <div className={`${card} px-4 py-14 text-center text-sm text-[var(--bn-admin-muted)]`}>Loading audits…</div>}
    </div>
  );
}

function NewAudit({ slug, onCancel, onCreated }: { slug: string; onCancel: () => void; onCreated: (id: string) => void }) {
  const [type, setType] = useState<AuditType>("STOCK");
  const [title, setTitle] = useState("");
  const [auditor, setAuditor] = useState("");
  const [scope, setScope] = useState("");
  const [busy, start] = useTransition();
  const submit = () => start(async () => {
    const res = await createFinancialAudit(slug, { title: title || `${typeLabel(type)} ${new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" })}`, type, auditorName: auditor, scope });
    if (res.success) { toast.success("Audit started"); onCreated(res.data.id); } else toast.error(res.error);
  });
  return (
    <div className={`${card} space-y-4 p-5`}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} aria-pressed={type === t.id} className={`rounded-xl border p-3 text-left transition ${type === t.id ? "border-[var(--bn-admin-orange)] bg-[var(--bn-admin-orange-soft)]" : "border-[var(--bn-admin-border)] hover:border-[var(--bn-admin-orange)]"}`}>
            <p className="text-sm font-bold">{t.label}</p><p className="mt-1 text-xs text-[var(--bn-admin-muted)]">{t.blurb}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-bold text-[var(--bn-admin-muted)]">Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${typeLabel(type)}, ${new Date().toLocaleDateString(undefined, { month: "long" })}`} className={field} /></label>
        <label className="space-y-1 text-xs font-bold text-[var(--bn-admin-muted)]">Auditor<input value={auditor} onChange={(e) => setAuditor(e.target.value)} placeholder="Name of the person or firm" className={field} /></label>
      </div>
      <label className="block space-y-1 text-xs font-bold text-[var(--bn-admin-muted)]">Scope (optional)<textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} placeholder="Which store room, till or period this covers" className={field} /></label>
      <div className="flex gap-2"><button className={btnPrimary} onClick={submit} disabled={busy}>{busy ? "Starting…" : "Start audit"}</button><button className={btnGhost} onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

function AuditDetail({ slug, audit, money, onBack, onChanged, busy }: { slug: string; audit: AuditView; money: (n: number) => string; onBack: () => void; onChanged: () => void; busy: boolean }) {
  const [tab, setTab] = useState<"count" | "findings" | "report">(audit.lines.length ? "count" : "findings");
  const [working, start] = useTransition();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [finding, setFinding] = useState({ title: "", detail: "", severity: "MEDIUM", recommendation: "" });
  const [conclusion, setConclusion] = useState(audit.conclusion ?? "");
  const [correctStock, setCorrectStock] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "TODO" | "DIFF">("ALL");
  const locked = audit.status === "SIGNED_OFF";
  const isCount = audit.lines.length > 0;
  const unit = audit.type === "CASH" ? "Amount" : "Qty";

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) => start(async () => {
    const res = await fn();
    if (res.success) { if (ok) toast.success(ok); onChanged(); } else toast.error(res.error ?? "Something went wrong");
  });

  // Recompute the summary live from what has been typed, before it is saved.
  const effective = audit.lines.map((l) => {
    const typed = local[l.id];
    const counted = typed === undefined ? l.countedQty : typed === "" ? null : Number(typed);
    return { ...l, counted: counted !== null && Number.isFinite(counted) ? counted : null };
  });
  const live = summariseCount(effective.map((l) => ({ expectedQty: l.expectedQty, countedQty: l.counted, unitCost: l.unitCost })));
  const shown = effective.filter((l) => filter === "ALL" || (filter === "TODO" ? l.counted === null : lineVariance({ expectedQty: l.expectedQty, countedQty: l.counted, unitCost: l.unitCost }).qty !== 0));

  const saveCount = (id: string, raw: string, note?: string) => {
    const n = raw === "" ? null : Number(raw);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return toast.error("Enter a count of zero or more.");
    start(async () => {
      const res = await recordAuditCount(slug, audit.id, id, n, note);
      if (!res.success) toast.error(res.error); else { setLocal((s) => { const c = { ...s }; delete c[id]; return c; }); onChanged(); }
    });
  };

  const exportCsv = () => download(`${audit.auditNo}.csv`, toCsv([
    [audit.title, audit.auditNo, typeLabel(audit.type), STATUS_LABEL[audit.status]], [],
    ["Item", "Code", `Expected ${unit.toLowerCase()}`, `Counted ${unit.toLowerCase()}`, "Unit value", "Variance", "Variance value", "Note"],
    ...effective.map((l) => { const v = lineVariance({ expectedQty: l.expectedQty, countedQty: l.counted, unitCost: l.unitCost }); return [l.label, l.sku, l.expectedQty, l.counted, l.unitCost, v.counted ? v.qty : null, v.counted ? v.value : null, l.note]; }),
    [], ["Findings"], ["Severity", "Finding", "Recommendation", "Status", "Management response"],
    ...audit.findings.map((f) => [f.severity, f.title, f.recommendation, f.status, f.response]),
    [], ["Conclusion", audit.conclusion],
  ]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <button onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--bn-admin-muted)] hover:text-[var(--bn-admin-orange)]"><ArrowLeft className="h-3.5 w-3.5" /> All audits</button>
          <h2 className="text-xl font-bold">{audit.title}</h2>
          <p className="mt-1 text-xs text-[var(--bn-admin-muted)]">{audit.auditNo} · {typeLabel(audit.type)} · {audit.auditorName ? `Auditor: ${audit.auditorName} · ` : ""}started {formatDate(new Date(audit.startedAt), { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[audit.status]}>{STATUS_LABEL[audit.status]}</Badge>
          <button className={btnGhost} onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Excel / CSV</button>
          <button className={btnGhost} onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</button>
          {!locked && <button className={`${btnGhost} text-rose-600`} onClick={() => { if (confirm("Delete this audit and everything recorded in it?")) run(async () => { const r = await deleteFinancialAudit(slug, audit.id); if (r.success) onBack(); return r; }); }}>Delete</button>}
        </div>
      </div>

      {isCount && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Progress" value={`${live.progressPct}%`} sub={`${live.counted} of ${live.total} counted`} />
          <Stat label="Accuracy" value={live.counted ? `${live.accuracyPct}%` : "n/a"} sub={`${live.matched} matched exactly`} tone={live.counted && live.accuracyPct >= 98 ? "good" : undefined} />
          <Stat label="Shortages" value={money(live.shortageValue)} sub={`${live.shortages} line${live.shortages === 1 ? "" : "s"} short`} tone={live.shortages ? "bad" : undefined} />
          <Stat label="Surpluses" value={money(live.surplusValue)} sub={`${live.surpluses} line${live.surpluses === 1 ? "" : "s"} over · net ${money(live.netVariance)}`} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 print:hidden">
        {isCount && <Chip active={tab === "count"} onClick={() => setTab("count")}>{audit.type === "CASH" ? "Cash count" : audit.type === "ASSETS" ? "Asset check" : "Count sheet"}</Chip>}
        <Chip active={tab === "findings"} onClick={() => setTab("findings")}>Findings {audit.findings.length ? `(${audit.findings.length})` : ""}</Chip>
        <Chip active={tab === "report"} onClick={() => setTab("report")}>Sign-off</Chip>
      </div>

      {tab === "count" && isCount && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 print:hidden">
            {([["ALL", "All"], ["TODO", `Still to count ${live.remaining}`], ["DIFF", "Differences only"]] as const).map(([k, l]) => <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</Chip>)}
          </div>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-[var(--bn-admin-border)] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--bn-admin-muted)]">
                <tr><th className="px-4 py-3">{audit.type === "CASH" ? "Account" : "Item"}</th><th className="px-4 py-3 text-right">System</th><th className="px-4 py-3 text-right">Counted</th><th className="px-4 py-3 text-right">Difference</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3">Note</th></tr>
              </thead>
              <tbody>
                {shown.map((l) => {
                  const v = lineVariance({ expectedQty: l.expectedQty, countedQty: l.counted, unitCost: l.unitCost });
                  return (
                    <tr key={l.id} className={`border-b border-[var(--bn-admin-border)] last:border-0 ${v.counted && v.qty !== 0 ? "bg-rose-50/40" : ""}`}>
                      <td className="px-4 py-2.5"><p className="font-semibold">{l.label}</p>{l.sku && <p className="text-xs text-[var(--bn-admin-muted)]">{l.sku}</p>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{audit.type === "CASH" ? money(l.expectedQty) : l.expectedQty}</td>
                      <td className="px-4 py-2.5 text-right">
                        {locked ? <span className="tabular-nums">{l.counted ?? ""}</span> : (
                          <input
                            inputMode="decimal" aria-label={`Counted for ${l.label}`} value={local[l.id] ?? (l.countedQty === null ? "" : String(l.countedQty))}
                            onChange={(e) => setLocal((s) => ({ ...s, [l.id]: e.target.value }))}
                            onBlur={(e) => { if (local[l.id] !== undefined && local[l.id] !== (l.countedQty === null ? "" : String(l.countedQty))) saveCount(l.id, e.target.value); }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            className={`${field} w-28 text-right tabular-nums`} placeholder="-"
                          />
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${v.qty > 0 ? "text-rose-600" : v.qty < 0 ? "text-sky-600" : "text-[var(--bn-admin-muted)]"}`}>{v.counted ? (v.qty === 0 ? "✓" : v.qty > 0 ? `-${v.qty}` : `+${-v.qty}`) : ""}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{v.counted && v.value !== 0 ? money(Math.abs(v.value)) : ""}</td>
                      <td className="px-4 py-2.5">{locked ? l.note : <input defaultValue={l.note ?? ""} aria-label={`Note for ${l.label}`} placeholder="Add a note" onBlur={(e) => { if (e.target.value !== (l.note ?? "")) saveCount(l.id, local[l.id] ?? (l.countedQty === null ? "" : String(l.countedQty)), e.target.value); }} className={`${field} min-w-[160px] py-1.5 text-xs`} />}</td>
                    </tr>
                  );
                })}
                {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--bn-admin-muted)]">Nothing to show here.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--bn-admin-muted)]">The system figures were frozen when this audit started, so sales made while you count do not change the expected quantities. Counts save when you leave the box.</p>
        </div>
      )}

      {tab === "findings" && (
        <div className="space-y-4">
          {!locked && (
            <div className={`${card} space-y-3 p-4 print:hidden`}>
              <p className="text-sm font-bold">Record a finding</p>
              <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                <input value={finding.title} onChange={(e) => setFinding({ ...finding, title: e.target.value })} placeholder="What did you find? e.g. Till short by ₦12,000 on Friday" className={field} />
                <select value={finding.severity} onChange={(e) => setFinding({ ...finding, severity: e.target.value })} className={field}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select>
              </div>
              <textarea value={finding.detail} onChange={(e) => setFinding({ ...finding, detail: e.target.value })} rows={2} placeholder="Details and evidence" className={field} />
              <input value={finding.recommendation} onChange={(e) => setFinding({ ...finding, recommendation: e.target.value })} placeholder="Recommendation" className={field} />
              <button className={btnPrimary} disabled={working || !finding.title.trim()} onClick={() => run(async () => { const r = await addAuditFinding(slug, audit.id, finding); if (r.success) setFinding({ title: "", detail: "", severity: "MEDIUM", recommendation: "" }); return r; }, "Finding recorded")}>Add finding</button>
            </div>
          )}
          {audit.findings.map((f) => <FindingCard key={f.id} f={f} slug={slug} auditId={audit.id} onChanged={onChanged} />)}
          {audit.findings.length === 0 && <div className={`${card} flex flex-col items-center gap-2 px-4 py-12 text-center`}><ShieldAlert className="h-6 w-6 text-[var(--bn-admin-muted)]" /><p className="text-sm text-[var(--bn-admin-muted)]">No findings recorded. Note anything that looks wrong: missing paperwork, weak controls, unexplained differences.</p></div>}
        </div>
      )}

      {tab === "report" && (
        <div className="space-y-4">
          <div className={`${card} space-y-4 p-5`}>
            <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-[var(--bn-admin-orange)]" /><h3 className="font-bold">Auditor's conclusion</h3></div>
            {locked ? (
              <>
                <p className="whitespace-pre-wrap text-sm">{audit.conclusion}</p>
                <p className="text-xs text-[var(--bn-admin-muted)]">Signed off by {audit.signedOffAt ? `on ${formatDate(new Date(audit.signedOffAt), { day: "numeric", month: "long", year: "numeric" })}` : ""} · net variance {money(audit.varianceValue)}</p>
              </>
            ) : (
              <>
                <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={4} placeholder="Summarise the result, the main risks and what should happen next." className={field} />
                <div className="flex flex-wrap gap-2">
                  {audit.status === "IN_PROGRESS" && <button className={btnGhost} disabled={working} onClick={() => run(() => submitAuditForReview(slug, audit.id), "Sent for review")}>Send for review</button>}
                  {audit.status === "UNDER_REVIEW" && <button className={btnGhost} disabled={working} onClick={() => run(() => reopenAudit(slug, audit.id), "Sent back to counting")}>Send back to counting</button>}
                  <button className={btnPrimary} disabled={working || conclusion.trim().length < 10} onClick={() => { if (confirm("Sign off this audit? It becomes a permanent record and can't be edited.")) run(() => signOffAudit(slug, audit.id, conclusion), "Audit signed off"); }}>Sign off audit</button>
                </div>
                <p className="text-xs text-[var(--bn-admin-muted)]">Signing off needs every line counted and no open critical findings.</p>
              </>
            )}
          </div>

          {locked && (audit.type === "STOCK" || audit.type === "CASH") && (
            <div className={`${card} space-y-3 p-5 print:hidden`}>
              <h3 className="font-bold">Book the difference</h3>
              {audit.journalPosted ? <Badge tone="green">Variance posted to the ledger</Badge> : Math.abs(audit.varianceValue) < 0.01 ? <p className="text-sm text-[var(--bn-admin-muted)]">Nothing to post: the count matched the books, or shortages and surpluses cancel out.</p> : (
                <>
                  <p className="text-sm text-[var(--bn-admin-muted)]">{audit.type === "STOCK" ? (audit.varianceValue > 0 ? `Stock was short by ${money(audit.varianceValue)}. This books it as a cost of sales and reduces Inventory.` : `Stock was over by ${money(-audit.varianceValue)}. This adds it to Inventory.`) : `Cash was ${audit.varianceValue > 0 ? "short" : "over"} by ${money(Math.abs(audit.varianceValue))}. This books each difference against the account counted.`}</p>
                  {audit.type === "STOCK" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={correctStock} onChange={(e) => setCorrectStock(e.target.checked)} /> Also correct the quantities on hand to what was counted</label>}
                  <button className={btnPrimary} disabled={working} onClick={() => { if (confirm("Post this variance to the ledger? This creates a journal entry.")) run(() => postAuditVariance(slug, audit.id, { correctStock: audit.type === "STOCK" && correctStock }), "Variance posted"); }}>Post to the ledger</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FindingCard({ f, slug, auditId, onChanged }: { f: AuditView["findings"][number]; slug: string; auditId: string; onChanged: () => void }) {
  const [reply, setReply] = useState(f.response ?? "");
  const [busy, start] = useTransition();
  const update = (patch: { status?: string; response?: string }) => start(async () => {
    const res = await updateAuditFinding(slug, auditId, f.id, patch);
    if (res.success) onChanged(); else toast.error(res.error);
  });
  return (
    <div className={`${card} space-y-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={SEV_TONE[f.severity]}>{f.severity[0] + f.severity.slice(1).toLowerCase()}</Badge><p className="font-bold">{f.title}</p></div>
          {f.detail && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--bn-admin-muted)]">{f.detail}</p>}
          {f.recommendation && <p className="mt-2 text-sm"><b>Recommendation:</b> {f.recommendation}</p>}</div>
        <select value={f.status} disabled={busy} onChange={(e) => update({ status: e.target.value })} aria-label="Finding status" className={`${field} w-auto py-1.5 text-xs`}>
          <option value="OPEN">Open</option><option value="ACTIONED">Action taken</option><option value="CLOSED">Closed</option>
        </select>
      </div>
      <div className="flex gap-2">
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Management response" className={`${field} py-2 text-xs`} />
        <button className={btnGhost} disabled={busy || reply === (f.response ?? "")} onClick={() => update({ response: reply })}>Save reply</button>
      </div>
    </div>
  );
}
