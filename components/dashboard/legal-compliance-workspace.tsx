"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, FileText, Plus, Scale, Trash2, Upload } from "lucide-react";
import { addLegalDocument, deleteLegalDocument, setLegalDocumentExpiry, type LegalApproval, type LegalDocument } from "@/lib/actions/legal-compliance";
import { decideApproval } from "@/lib/actions/business-platform";

const TYPES = ["Contract", "Business licence", "Permit", "Tax certificate", "Insurance", "Lease / tenancy", "Policy", "Other"];
type Filter = "all" | "expired" | "soon" | "valid" | "none";
type Status = "expired" | "soon" | "valid" | "none";

function statusOf(expiresAt: string | null): { status: Status; days: number | null } {
  if (!expiresAt) return { status: "none", days: null };
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { status: "expired", days };
  if (days <= 30) return { status: "soon", days };
  return { status: "valid", days };
}

const BADGE: Record<Status, string> = {
  expired: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  valid: "bg-emerald-100 text-emerald-700",
  none: "bg-muted text-muted-foreground",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function label(s: Status, days: number | null) {
  if (s === "expired") return `Expired ${Math.abs(days ?? 0)}d ago`;
  if (s === "soon") return days === 0 ? "Expires today" : `Expires in ${days}d`;
  if (s === "valid") return "Valid";
  return "No expiry";
}

export function LegalComplianceWorkspace({ slug, data }: { slug: string; data: { documents: LegalDocument[]; approvals: LegalApproval[] } }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ title: "", documentType: TYPES[0], fileUrl: "", expiresAt: "", notes: "" });
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(data.documents.length === 0);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const rows = useMemo(() => data.documents.map((d) => ({ d, ...statusOf(d.expiresAt) })), [data.documents]);
  const counts = useMemo(() => ({
    all: rows.length,
    expired: rows.filter((r) => r.status === "expired").length,
    soon: rows.filter((r) => r.status === "soon").length,
    valid: rows.filter((r) => r.status === "valid").length,
    none: rows.filter((r) => r.status === "none").length,
  }), [rows]);
  const visible = rows.filter((r) => (filter === "all" || r.status === filter) && (!q.trim() || `${r.d.title} ${r.d.documentType}`.toLowerCase().includes(q.trim().toLowerCase())));

  const field = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm";
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.success) toast.error(r.error ?? "Something went wrong.");
      else { toast.success(ok); after?.(); router.refresh(); }
    });

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
      setForm((f) => ({ ...f, fileUrl: json.url, title: f.title || file.name.replace(/\.[^.]+$/, "") }));
      toast.success("File uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const add = () => run(() => addLegalDocument(slug, form), "Document added", () => { setForm({ title: "", documentType: TYPES[0], fileUrl: "", expiresAt: "", notes: "" }); setShowForm(false); });

  const cards: [string, number, typeof FileText, string][] = [
    ["Documents", counts.all, FileText, "text-primary"],
    ["Valid", counts.valid + counts.none, CheckCircle2, "text-emerald-600"],
    ["Expiring in 30 days", counts.soon, Clock3, "text-amber-600"],
    ["Expired", counts.expired, AlertTriangle, "text-red-600"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest App</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><Scale className="h-5 w-5 text-primary" /> Legal &amp; Compliance</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Keep contracts, licences, permits and certificates in one register, and never miss an expiry.</p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><Plus className="mr-1 inline h-3.5 w-3.5" /> Add document</button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([l, v, Icon, c]) => <div key={l} className="rounded-2xl border bg-background p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{l}</span><Icon className={`h-4 w-4 ${c}`} /></div><p className="mt-2 text-2xl font-bold">{v}</p></div>)}
      </div>

      {showForm && (
        <section className="space-y-3 rounded-2xl border bg-background p-4 shadow-sm">
          <h2 className="text-sm font-bold">Add a document</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className={field} placeholder="Title (e.g. Shop lease 2026)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className={field} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Expiry date (leave empty if it doesn&apos;t expire)</label>
              <input type="date" className={field} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">File (PDF or image, max 10MB)</label>
              <label className={`${field} flex cursor-pointer items-center gap-2 text-muted-foreground`}>
                <Upload className="h-4 w-4" /><span className="truncate">{uploading ? "Uploading..." : form.fileUrl ? "File attached — tap to replace" : "Choose file"}</span>
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
          <input className={field} placeholder="Or paste a secure https link" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} />
          <textarea className={field} rows={2} placeholder="Notes (optional): parties, renewal terms, who to contact" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || uploading} onClick={add} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? "Saving..." : "Save document"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2.5 text-xs font-semibold">Cancel</button>
          </div>
        </section>
      )}

      {data.approvals.length > 0 && (
        <section className="rounded-2xl border bg-background p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold">Pending approvals ({data.approvals.length})</h2>
          <ul className="space-y-2">
            {data.approvals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate"><span className="font-medium">{a.title}</span> <span className="text-xs text-muted-foreground">· {a.requestType}</span></span>
                <span className="flex gap-1.5">
                  <button type="button" disabled={busy} onClick={() => run(() => decideApproval(slug, a.id, "APPROVED") as any, "Approved")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Approve</button>
                  <button type="button" disabled={busy} onClick={() => run(() => decideApproval(slug, a.id, "REJECTED") as any, "Rejected")} className="rounded-lg border px-3 py-1.5 text-[11px] font-bold disabled:opacity-50">Reject</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-background p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([["all", "All"], ["expired", "Expired"], ["soon", "Expiring soon"], ["valid", "Valid"], ["none", "No expiry"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === k ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>{l} ({counts[k]})</button>
          ))}
          <input className="ml-auto w-full rounded-lg border bg-background px-3 py-1.5 text-xs sm:w-48" placeholder="Search documents" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {visible.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{data.documents.length === 0 ? "No documents yet. Tap Add document to register your first contract, licence or permit." : "Nothing matches this filter."}</p>
        ) : (
          <ul className="divide-y">
            {visible.map(({ d, status, days }) => (
              <li key={d.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.documentType}{d.expiresAt ? ` · expires ${fmt(d.expiresAt)}` : ""}</p>
                    {d.notes && <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${BADGE[status]}`}>{label(status, days)}</span>
                </div>
                {editing?.id === d.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" className="rounded-lg border bg-background px-2 py-1.5 text-xs" value={editing.value} onChange={(e) => setEditing({ id: d.id, value: e.target.value })} />
                    <button type="button" disabled={busy} onClick={() => run(() => setLegalDocumentExpiry(slug, d.id, editing.value || null), "Expiry updated", () => setEditing(null))} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold">Cancel</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-semibold"><ExternalLink className="h-3 w-3" /> Open</a>
                    <button type="button" onClick={() => setEditing({ id: d.id, value: d.expiresAt ? d.expiresAt.slice(0, 10) : "" })} className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold">{status === "expired" || status === "soon" ? "Renew" : "Change expiry"}</button>
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete "${d.title}"?`)) run(() => deleteLegalDocument(slug, d.id), "Document deleted"); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-semibold text-red-600 disabled:opacity-50"><Trash2 className="h-3 w-3" /> Delete</button>
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
