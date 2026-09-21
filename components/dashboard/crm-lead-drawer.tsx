"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarClock, Mail, MessageCircle, Phone, StickyNote, Users, X, type LucideIcon } from "lucide-react";
import { addCrmActivity, updateCrmLeadDetails } from "@/lib/actions/seo-crm";
import { STAGES, initials, money, shortDate, sourceLabel, stageOf, type Lead, type LeadActivity } from "@/components/dashboard/crm-types";

const ACTIVITY_TYPES: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "NOTE", label: "Note", icon: StickyNote },
  { id: "CALL", label: "Call", icon: Phone },
  { id: "EMAIL", label: "Email", icon: Mail },
  { id: "MEETING", label: "Meeting", icon: Users },
];
const iconFor = (type: string) => ACTIVITY_TYPES.find((t) => t.id === type.toUpperCase())?.icon ?? StickyNote;

const toDateInput = (d: Date | string | null) => {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export function LeadDrawer({
  slug,
  lead,
  onClose,
  onMove,
  onPatch,
  onActivity,
}: {
  slug: string;
  lead: Lead;
  onClose: () => void;
  onMove: (status: string) => void;
  onPatch: (patch: Partial<Lead>) => void;
  onActivity: (activity: LeadActivity) => void;
}) {
  const [value, setValue] = useState(lead.value ? String(lead.value) : "");
  const [follow, setFollow] = useState(toDateInput(lead.nextFollowUpAt));
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [type, setType] = useState("NOTE");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dirty = value !== (lead.value ? String(lead.value) : "") || follow !== toDateInput(lead.nextFollowUpAt) || notes !== (lead.notes ?? "");
  const stage = stageOf(lead.status);
  const field = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  function save() {
    setError("");
    const numeric = value.trim() === "" ? null : Number(value);
    if (numeric !== null && (!Number.isFinite(numeric) || numeric < 0)) return setError("Enter a valid value.");
    const nextFollowUpAt = follow ? new Date(`${follow}T09:00:00`).toISOString() : null;
    start(async () => {
      const r = await updateCrmLeadDetails(slug, lead.id, { value: numeric, nextFollowUpAt, notes: notes.trim() || null });
      if (r.success) {
        onPatch({ value: numeric, nextFollowUpAt, notes: notes.trim() || null });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else setError(("error" in r && r.error) || "Could not save changes.");
    });
  }

  function logActivity() {
    setError("");
    if (!title.trim()) return setError("Add a short title for the activity.");
    start(async () => {
      const r = await addCrmActivity(slug, lead.id, { type, title, body });
      if (r.success && "data" in r && r.data) {
        onActivity({ id: r.data.id, type: r.data.type, title: r.data.title, body: r.data.body, createdAt: r.data.createdAt });
        onPatch({ lastContactedAt: new Date().toISOString() });
        setTitle("");
        setBody("");
      } else setError(("error" in r && r.error) || "Could not log activity.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={`Lead: ${lead.name}`} className="flex h-full w-full max-w-md flex-col overflow-hidden border-l bg-background shadow-2xl">
        <header className="flex items-start gap-3 border-b p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-sm font-bold text-primary">{initials(lead.name)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold leading-tight">{lead.name}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{[lead.company, sourceLabel(lead.source)].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section aria-label="Stage">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Stage</p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button key={s.id} type="button" aria-pressed={lead.status === s.id} onClick={() => lead.status !== s.id && onMove(s.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${lead.status === s.id ? s.active : "hover:border-primary/50"}`}>{s.label}</button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{stage.hint}</p>
          </section>

          {(lead.email || lead.phone) && (
            <section aria-label="Contact" className="flex flex-wrap gap-2">
              {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:border-primary"><Mail className="h-3.5 w-3.5" />{lead.email}</a>}
              {lead.phone && <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:border-primary"><Phone className="h-3.5 w-3.5" />{lead.phone}</a>}
              {lead.phone && <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:border-primary"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
            </section>
          )}

          <section aria-label="Details" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-xs font-medium">Deal value (₦)<input type="number" min="0" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className={field} /></label>
              <label className="grid gap-1.5 text-xs font-medium">Next follow-up<input type="date" value={follow} onChange={(e) => setFollow(e.target.value)} className={field} /></label>
            </div>
            <label className="grid gap-1.5 text-xs font-medium">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What do you need to remember about this lead?" className={field} /></label>
            <div className="flex items-center gap-3">
              <button type="button" disabled={!dirty || pending} onClick={save} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">{pending ? "Saving…" : "Save changes"}</button>
              {saved && <span className="text-xs font-medium text-emerald-600">Saved</span>}
              {lead.value ? <span className="ml-auto text-xs text-muted-foreground">Current: {money(lead.value)}</span> : null}
            </div>
          </section>

          <section aria-label="Activity">
            <h3 className="mb-3 text-sm font-semibold">Activity</h3>
            <div className="rounded-xl border p-3">
              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Activity type">
                {ACTIVITY_TYPES.map((t) => {
                  const Icon = t.icon;
                  return <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${type === t.id ? "border-primary bg-[hsl(var(--primary)/0.1)] text-primary" : "hover:border-primary/40"}`}><Icon className="h-3 w-3" />{t.label}</button>;
                })}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} placeholder="What happened? e.g. Called about the quote" className={field} />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Details (optional)" className={`${field} mt-2`} />
              <button type="button" disabled={pending || !title.trim()} onClick={logActivity} className="mt-2 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-primary disabled:opacity-40">Log activity</button>
            </div>

            {lead.activities.length ? (
              <ol className="mt-4 space-y-4 border-l pl-4">
                {lead.activities.map((a) => {
                  const Icon = iconFor(a.type);
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[26px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground"><Icon className="h-3 w-3" /></span>
                      <p className="text-sm font-medium leading-snug">{a.title}</p>
                      {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarClock className="h-3 w-3" />{new Date(a.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">No activity yet. Log your first call or note above.</p>
            )}
            {lead.createdAt && <p className="mt-4 text-[11px] text-muted-foreground">Lead added {shortDate(lead.createdAt)}</p>}
          </section>

          {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">{error}</p>}
        </div>
      </aside>
    </div>
  );
}
